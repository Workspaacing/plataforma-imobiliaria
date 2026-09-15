"use client"

import * as React from "react"

import { formatBytes, formatSizeChange } from "@workspace/core/media/format"

import { LANDING_ASSETS_BUCKET, LANDING_MAX_IMAGE_BYTES } from "@/lib/marketing/constants"
import { translateLandingStorageError } from "@/lib/marketing/errors"
import { getImagePreparationMessage, prepareImage } from "@/lib/media/compress-image"
import { UPLOADS_BLOCKED_MESSAGE, isStorageForbiddenError } from "@/lib/media/upload-errors"
import { createClient } from "@/lib/supabase/client"

/** `banner`: JPEG até 1920 px (fundo, banners, compartilhamento). `logo`: até 512 px com transparência. */
export type LandingAssetKind = "banner" | "logo"

export type LandingUploadPhase = "optimizing" | "uploading"

export type LandingUploadResult =
  { ok: true; path: string; sizeLabel: string } | { ok: false; error: string }

/**
 * Otimiza a imagem no navegador e envia direto ao bucket landing-assets, no
 * caminho {organization_id}/landing/{page_id}/{uuid}.{ext}. O RLS do Storage
 * confere o papel; o caminho é conferido de novo pela Server Action que salva
 * a seção.
 */
export function useLandingAssetUpload({
  organizationId,
  pageId,
  uploadsBlocked = false,
}: {
  organizationId: string
  pageId: string
  /** Assinatura em modo leitura: não tenta enviar. */
  uploadsBlocked?: boolean
}) {
  const [pendingCount, setPendingCount] = React.useState(0)
  const [phase, setPhase] = React.useState<LandingUploadPhase | null>(null)

  const upload = React.useCallback(
    async (file: File, kind: LandingAssetKind = "banner"): Promise<LandingUploadResult> => {
      if (uploadsBlocked) {
        return { ok: false, error: UPLOADS_BLOCKED_MESSAGE }
      }

      setPendingCount((count) => count + 1)
      setPhase("optimizing")

      try {
        let prepared: Awaited<ReturnType<typeof prepareImage>>
        try {
          prepared = await prepareImage(file, kind === "logo" ? "landingLogo" : "landingBanner")
        } catch (error) {
          return { ok: false, error: getImagePreparationMessage(error) }
        }

        const { main } = prepared
        if (main.bytes > LANDING_MAX_IMAGE_BYTES) {
          return {
            ok: false,
            error: `Mesmo otimizada, a imagem tem ${formatBytes(main.bytes)}; o limite é ${formatBytes(LANDING_MAX_IMAGE_BYTES)}.`,
          }
        }

        const path = `${organizationId}/landing/${pageId}/${crypto.randomUUID()}.${main.extension}`
        setPhase("uploading")

        const supabase = createClient()
        const { error } = await supabase.storage
          .from(LANDING_ASSETS_BUCKET)
          .upload(path, main.blob, {
            contentType: main.type,
            cacheControl: "31536000",
            upsert: false,
          })

        if (error) {
          return {
            ok: false,
            error: isStorageForbiddenError(error)
              ? UPLOADS_BLOCKED_MESSAGE
              : translateLandingStorageError(error, "enviar imagens para esta landing page"),
          }
        }

        return { ok: true, path, sizeLabel: formatSizeChange(file.size, main.bytes) }
      } catch {
        return {
          ok: false,
          error: "Não foi possível enviar a imagem agora. Tente novamente.",
        }
      } finally {
        setPendingCount((count) => Math.max(0, count - 1))
        setPhase(null)
      }
    },
    [organizationId, pageId, uploadsBlocked]
  )

  return { upload, isUploading: pendingCount > 0, phase }
}
