import { HouseIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { getPropertyMediaPublicUrl } from "@/lib/imoveis/media-url"

/**
 * Foto de capa pela URL pública do bucket. Usa <img> simples: o domínio do
 * Storage não está em images.remotePatterns do next.config.
 */
export function PropertyCover({
  storagePath,
  alt,
  className,
}: {
  storagePath: string | null | undefined
  alt: string
  className?: string
}) {
  const url = getPropertyMediaPublicUrl(storagePath)

  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-muted text-muted-foreground",
          className
        )}
        aria-hidden="true"
      >
        <HouseIcon />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("rounded-md object-cover", className)}
    />
  )
}
