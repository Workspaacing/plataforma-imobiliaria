"use server"

import type { ActionResult } from "@/lib/auth/action-result"
import { ACCEPTED_IMAGE_TYPES, CAPTION_MAX_LENGTH, PROPERTY_MEDIA_BUCKET } from "@/lib/imoveis/constants"
import { translateDbError } from "@/lib/imoveis/db-errors"
import { isUuid } from "@/lib/imoveis/ids"
import { canDeletePropertyRecords } from "@/lib/imoveis/permissions"
import type { ServerSupabaseClient } from "@/lib/imoveis/queries"
import {
  getPropertyActionContext,
  refreshImobScore,
  revalidatePropertyPaths,
} from "@/lib/imoveis/server-context"

const MAX_IMAGES_PER_CALL = 50
const EXTENSIONS = new Set(Object.values(ACCEPTED_IMAGE_TYPES))

type ImageRow = {
  id: string
  position: number
  is_cover: boolean
  storage_path: string | null
}

async function loadImages(supabase: ServerSupabaseClient, organizationId: string, propertyId: string) {
  const { data, error } = await supabase
    .from("property_media")
    .select("id, position, is_cover, storage_path")
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId)
    .eq("kind", "image")
    .order("position")
    .order("created_at")

  return { images: (data ?? []) as ImageRow[], error }
}

/** Grava posições 0..n-1 na ordem recebida (só as que mudaram). */
async function persistOrder(supabase: ServerSupabaseClient, ordered: readonly ImageRow[]) {
  for (const [index, image] of ordered.entries()) {
    if (image.position === index) continue
    const { error } = await supabase.from("property_media").update({ position: index }).eq("id", image.id)
    if (error) return error
  }
  return null
}

function isExpectedStoragePath(path: string, organizationId: string, propertyId: string) {
  const prefix = `${organizationId}/properties/${propertyId}/`
  if (!path.startsWith(prefix)) return false

  const fileName = path.slice(prefix.length)
  const match = /^([0-9a-f-]{36})\.([a-z]+)$/i.exec(fileName)
  return Boolean(match && isUuid(match[1]) && EXTENSIONS.has((match[2] ?? "").toLowerCase()))
}

/**
 * Registra fotos que o navegador já enviou ao bucket (o RLS do Storage validou
 * o envio). Novas fotos entram no fim; a primeira vira capa se não houver.
 */
export async function registerPropertyImagesAction(propertyId: string, storagePaths: string[]): Promise<ActionResult> {
  if (!Array.isArray(storagePaths) || storagePaths.length === 0) {
    return { ok: false, error: "Nenhuma foto para registrar." }
  }
  if (storagePaths.length > MAX_IMAGES_PER_CALL) {
    return { ok: false, error: `Envie no máximo ${MAX_IMAGES_PER_CALL} fotos por vez.` }
  }

  const loaded = await getPropertyActionContext(propertyId)
  if (!loaded.ok) return loaded

  const { supabase, organizationId, property } = loaded.context
  const paths = [...new Set(storagePaths)]

  if (!paths.every((path) => isExpectedStoragePath(path, organizationId, property.id))) {
    return { ok: false, error: "Arquivo enviado para uma pasta inválida." }
  }

  const { images, error: loadError } = await loadImages(supabase, organizationId, property.id)
  if (loadError) {
    return { ok: false, error: translateDbError(loadError, "registrar as fotos") }
  }

  const nextPosition = images.reduce((max, image) => Math.max(max, image.position + 1), 0)
  const hasCover = images.some((image) => image.is_cover)

  const { error } = await supabase.from("property_media").insert(
    paths.map((path, index) => ({
      organization_id: organizationId,
      property_id: property.id,
      kind: "image" as const,
      storage_path: path,
      position: nextPosition + index,
      is_cover: !hasCover && index === 0,
    }))
  )

  if (error) {
    return { ok: false, error: translateDbError(error, "adicionar fotos a este imóvel") }
  }

  await refreshImobScore(supabase, organizationId, property.id)
  revalidatePropertyPaths(property.id)

  return {
    ok: true,
    message: paths.length === 1 ? "Foto adicionada." : `${paths.length} fotos adicionadas.`,
  }
}

export async function moveMediaAction(
  propertyId: string,
  mediaId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  if (!isUuid(mediaId) || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Foto inválida." }
  }

  const loaded = await getPropertyActionContext(propertyId)
  if (!loaded.ok) return loaded

  const { supabase, organizationId, property } = loaded.context
  const { images, error: loadError } = await loadImages(supabase, organizationId, property.id)
  if (loadError) {
    return { ok: false, error: translateDbError(loadError, "reordenar as fotos") }
  }

  const index = images.findIndex((image) => image.id === mediaId)
  const target = direction === "up" ? index - 1 : index + 1
  const current = images[index]
  const swap = images[target]

  if (index < 0 || !current || !swap) {
    return { ok: true }
  }

  const ordered = [...images]
  ordered[index] = swap
  ordered[target] = current

  const error = await persistOrder(supabase, ordered)
  if (error) {
    return { ok: false, error: translateDbError(error, "reordenar as fotos") }
  }

  revalidatePropertyPaths(property.id)
  return { ok: true }
}

export async function setCoverMediaAction(propertyId: string, mediaId: string): Promise<ActionResult> {
  if (!isUuid(mediaId)) {
    return { ok: false, error: "Foto inválida." }
  }

  const loaded = await getPropertyActionContext(propertyId)
  if (!loaded.ok) return loaded

  const { supabase, organizationId, property } = loaded.context
  const { images, error: loadError } = await loadImages(supabase, organizationId, property.id)
  if (loadError) {
    return { ok: false, error: translateDbError(loadError, "definir a capa") }
  }

  const selected = images.find((image) => image.id === mediaId)
  if (!selected) {
    return { ok: false, error: "Foto não encontrada neste imóvel." }
  }
  if (selected.is_cover) {
    return { ok: true, message: "Esta foto já é a capa." }
  }

  // Índice único parcial: no máximo uma capa por imóvel. Desmarca antes de marcar.
  const previousCovers = images.filter((image) => image.is_cover).map((image) => image.id)
  if (previousCovers.length > 0) {
    const { error } = await supabase.from("property_media").update({ is_cover: false }).in("id", previousCovers)
    if (error) {
      return { ok: false, error: translateDbError(error, "definir a capa") }
    }
  }

  const { data, error } = await supabase
    .from("property_media")
    .update({ is_cover: true })
    .eq("id", selected.id)
    .select("id")

  if (error || !data?.length) {
    if (previousCovers.length > 0) {
      await supabase.from("property_media").update({ is_cover: true }).in("id", previousCovers.slice(0, 1))
    }
    return {
      ok: false,
      error: error ? translateDbError(error, "definir a capa") : "Você não tem permissão para definir a capa.",
    }
  }

  revalidatePropertyPaths(property.id)
  return { ok: true, message: "Capa atualizada." }
}

export async function updateMediaCaptionAction(
  propertyId: string,
  mediaId: string,
  caption: string
): Promise<ActionResult> {
  const text = String(caption ?? "").trim()

  if (!isUuid(mediaId)) {
    return { ok: false, error: "Foto inválida." }
  }
  if (text.length > CAPTION_MAX_LENGTH) {
    return { ok: false, error: `A legenda pode ter no máximo ${CAPTION_MAX_LENGTH} caracteres.` }
  }

  const loaded = await getPropertyActionContext(propertyId)
  if (!loaded.ok) return loaded

  const { supabase, organizationId, property } = loaded.context
  const { data, error } = await supabase
    .from("property_media")
    .update({ caption: text || null })
    .eq("organization_id", organizationId)
    .eq("property_id", property.id)
    .eq("id", mediaId)
    .select("id")

  if (error) {
    return { ok: false, error: translateDbError(error, "editar a legenda") }
  }
  if (!data?.length) {
    return { ok: false, error: "Foto não encontrada ou sem permissão para editar." }
  }

  revalidatePropertyPaths(property.id)
  return { ok: true, message: "Legenda salva." }
}

/** Remove a foto (linha e arquivo). RLS: só dono e gerente removem mídias. */
export async function removeMediaAction(propertyId: string, mediaId: string): Promise<ActionResult> {
  if (!isUuid(mediaId)) {
    return { ok: false, error: "Foto inválida." }
  }

  const loaded = await getPropertyActionContext(propertyId, { requireEdit: false })
  if (!loaded.ok) return loaded

  const { supabase, organizationId, role, property } = loaded.context

  if (!canDeletePropertyRecords(role)) {
    return { ok: false, error: "Somente o dono ou o gerente podem remover fotos." }
  }

  const { data: removed, error } = await supabase
    .from("property_media")
    .delete()
    .eq("organization_id", organizationId)
    .eq("property_id", property.id)
    .eq("id", mediaId)
    .select("id, storage_path, is_cover, kind")

  if (error) {
    return { ok: false, error: translateDbError(error, "remover fotos") }
  }

  const row = removed?.[0]
  if (!row) {
    return { ok: false, error: "Foto não encontrada ou sem permissão para remover." }
  }

  let warning: string | undefined

  if (row.storage_path) {
    const { error: storageError } = await supabase.storage.from(PROPERTY_MEDIA_BUCKET).remove([row.storage_path])
    if (storageError) {
      warning = "A foto saiu do anúncio, mas o arquivo não pôde ser apagado do armazenamento."
    }
  }

  const { images } = await loadImages(supabase, organizationId, property.id)
  await persistOrder(supabase, images)

  const firstImage = images[0]
  if (row.is_cover && firstImage && !images.some((image) => image.is_cover)) {
    await supabase.from("property_media").update({ is_cover: true }).eq("id", firstImage.id)
  }

  await refreshImobScore(supabase, organizationId, property.id)
  revalidatePropertyPaths(property.id)

  return { ok: true, message: warning ?? "Foto removida." }
}
