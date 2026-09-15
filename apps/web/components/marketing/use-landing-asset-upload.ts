"use client"

import * as React from "react"

import {
  LANDING_ACCEPTED_IMAGE_TYPES,
  LANDING_ASSETS_BUCKET,
  LANDING_MAX_IMAGE_BYTES,
} from "@/lib/marketing/constants"
import { translateLandingStorageError } from "@/lib/marketing/errors"
import { createClient } from "@/lib/supabase/client"

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

export type LandingUploadResult = { ok: true; path: string } | { ok: false; error: string }

/** Tipo MIME aceito (alguns sistemas não informam o tipo; usa a extensão). */
function resolveImageType(file: File) {
  if (LANDING_ACCEPTED_IMAGE_TYPES[file.type]) return file.type
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  return EXTENSION_TYPES[extension] ?? null
}

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`
}

/**
 * Upload direto do navegador ao bucket landing-assets, no caminho
 * {organization_id}/landing/{page_id}/{uuid}.{ext}. O RLS do Storage confere o
 * papel; o caminho é conferido de novo pela Server Action que salva a seção.
 */
export function useLandingAssetUpload({
  organizationId,
  pageId,
}: {
  organizationId: string
  pageId: string
}) {
  const [pendingCount, setPendingCount] = React.useState(0)

  const upload = React.useCallback(
    async (file: File): Promise<LandingUploadResult> => {
      const type = resolveImageType(file)

      if (!type) {
        return {
          ok: false,
          error: "Formato não aceito. Envie JPG, PNG ou WebP.",
        }
      }
      if (file.size > LANDING_MAX_IMAGE_BYTES) {
        return {
          ok: false,
          error: `O arquivo tem ${formatMegabytes(file.size)}; o limite é 5 MB.`,
        }
      }

      const extension = LANDING_ACCEPTED_IMAGE_TYPES[type]
      const path = `${organizationId}/landing/${pageId}/${crypto.randomUUID()}.${extension}`

      setPendingCount((count) => count + 1)

      try {
        const supabase = createClient()
        const { error } = await supabase.storage.from(LANDING_ASSETS_BUCKET).upload(path, file, {
          contentType: type,
          cacheControl: "31536000",
          upsert: false,
        })

        if (error) {
          return {
            ok: false,
            error: translateLandingStorageError(error, "enviar imagens para esta landing page"),
          }
        }

        return { ok: true, path }
      } catch {
        return {
          ok: false,
          error: "Não foi possível enviar a imagem agora. Tente novamente.",
        }
      } finally {
        setPendingCount((count) => Math.max(0, count - 1))
      }
    },
    [organizationId, pageId]
  )

  return { upload, isUploading: pendingCount > 0 }
}
