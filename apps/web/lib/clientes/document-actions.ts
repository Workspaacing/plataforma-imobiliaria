"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { ActionResult } from "@/lib/auth/action-result"
import { requireMembership } from "@/lib/auth/session"
import type { ActionResultWithData } from "@/lib/clientes/action-result"
import {
  CLIENT_DOCUMENT_MAX_BYTES,
  CLIENT_DOCUMENT_MIME_TYPES,
  CLIENT_DOCUMENT_SIGNED_URL_TTL,
  CLIENT_DOCUMENTS_BUCKET,
  CLIENTS_PATH,
} from "@/lib/clientes/constants"
import { permissionDeniedMessage, translateDatabaseError } from "@/lib/clientes/db-errors"
import { canDeleteClientData } from "@/lib/clientes/permissions"
import { createClient } from "@/lib/supabase/server"

const idSchema = z.guid()

const registerDocumentSchema = z.object({
  clientId: z.guid(),
  storagePath: z.string().min(1).max(512),
  name: z.string().trim().min(1, "Arquivo sem nome.").max(200, "Nome de arquivo longo demais."),
  mimeType: z.enum(CLIENT_DOCUMENT_MIME_TYPES, {
    error: "Formato não aceito. Envie PDF, JPG, PNG ou WebP.",
  }),
  sizeBytes: z
    .number()
    .int()
    .positive("Arquivo vazio.")
    .max(CLIENT_DOCUMENT_MAX_BYTES, "O arquivo passa de 20 MB."),
})

export type RegisterClientDocumentInput = z.input<typeof registerDocumentSchema>

/**
 * Registra a linha do documento depois que o navegador enviou o arquivo ao
 * bucket privado. O caminho precisa ser da imobiliária e do cliente informados.
 */
export async function registerClientDocument(
  input: RegisterClientDocumentInput
): Promise<ActionResult> {
  const parsed = registerDocumentSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Arquivo inválido." }
  }

  const { membership } = await requireMembership()
  const action = "enviar documentos deste cliente"

  if (membership.role === "finance") {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  const { clientId, storagePath, name, mimeType, sizeBytes } = parsed.data
  const prefix = `${membership.organizationId}/clients/${clientId}/`
  const fileSegment = storagePath.slice(prefix.length)

  if (!storagePath.startsWith(prefix) || !fileSegment || fileSegment.includes("/")) {
    return { ok: false, error: "O caminho do arquivo é inválido." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("client_documents").insert({
    organization_id: membership.organizationId,
    client_id: clientId,
    name,
    storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: sizeBytes,
  })

  if (error) {
    return { ok: false, error: translateDatabaseError(error, action) }
  }

  revalidatePath(`${CLIENTS_PATH}/${clientId}`)

  return { ok: true, message: "Documento enviado." }
}

/**
 * URL assinada de curta duração para baixar o documento. O download só é
 * liberado se o acesso for registrado (LGPD).
 */
export async function getClientDocumentDownloadUrl(
  documentId: string
): Promise<ActionResultWithData<{ url: string }>> {
  if (!idSchema.safeParse(documentId).success) {
    return { ok: false, error: "Documento inválido." }
  }

  const { membership } = await requireMembership()
  const supabase = await createClient()
  const { data: document, error } = await supabase
    .from("client_documents")
    .select("id, name, storage_path")
    .eq("id", documentId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: translateDatabaseError(error, "baixar este documento") }
  }

  if (!document) {
    return { ok: false, error: "Documento não encontrado. Ele pode ter sido removido." }
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .createSignedUrl(document.storage_path, CLIENT_DOCUMENT_SIGNED_URL_TTL, {
      download: document.name,
    })

  if (signError || !signed?.signedUrl) {
    return { ok: false, error: "Não foi possível gerar o link de download. Tente novamente." }
  }

  const { error: logError } = await supabase.rpc("log_access_event", {
    p_entity: "client_documents",
    p_entity_id: document.id,
    p_action: "download",
  })

  if (logError) {
    console.error("[clientes] falha ao registrar download de documento:", logError.code ?? "erro")
    return {
      ok: false,
      error: "Não foi possível registrar o acesso ao documento. Tente novamente.",
    }
  }

  return { ok: true, data: { url: signed.signedUrl } }
}

/** Remove o documento (dono/gerente): a linha e o arquivo no Storage. */
export async function deleteClientDocument(
  documentId: string,
  clientId: string
): Promise<ActionResult> {
  if (!idSchema.safeParse(documentId).success || !idSchema.safeParse(clientId).success) {
    return { ok: false, error: "Documento inválido." }
  }

  const { membership } = await requireMembership()
  const action = "remover documentos"

  if (!canDeleteClientData(membership.role)) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("client_documents")
    .delete()
    .eq("id", documentId)
    .eq("client_id", clientId)
    .eq("organization_id", membership.organizationId)
    .select("storage_path")

  if (error) {
    return { ok: false, error: translateDatabaseError(error, action) }
  }

  const removed = data[0]

  if (!removed) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  const { error: storageError } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .remove([removed.storage_path])

  if (storageError) {
    console.error("[clientes] documento excluído, mas o arquivo ficou no Storage:", storageError.name)
  }

  revalidatePath(`${CLIENTS_PATH}/${clientId}`)

  return { ok: true, message: "Documento removido." }
}
