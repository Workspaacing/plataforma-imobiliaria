"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImageIcon,
  ImagePlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { useLandingAssetUpload } from "@/components/marketing/use-landing-asset-upload"
import { getLandingAssetPublicUrl } from "@/lib/marketing/asset-url"
import { LANDING_ACCEPTED_IMAGE_ACCEPT_ATTR } from "@/lib/marketing/constants"

type UploadTarget = { organizationId: string; pageId: string }

function notifyUploadError(error: string) {
  toast.add({ type: "error", title: "Imagem não enviada", description: error })
}

function HiddenFileInput({
  inputRef,
  label,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  label: string
  onFile: (file: File) => void
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={LANDING_ACCEPTED_IMAGE_ACCEPT_ATTR}
      className="sr-only"
      tabIndex={-1}
      aria-label={label}
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (file) onFile(file)
      }}
    />
  )
}

function Thumbnail({
  url,
  alt,
  aspect,
  fit = "cover",
}: {
  url: string | null
  alt: string
  aspect: "wide" | "square" | "logo"
  fit?: "cover" | "contain"
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground",
        aspect === "wide" && "aspect-video w-32",
        aspect === "square" && "size-20",
        aspect === "logo" && "h-16 w-32"
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className={cn("size-full", fit === "contain" ? "object-contain p-1" : "object-cover")}
        />
      ) : (
        <ImageIcon aria-hidden="true" />
      )}
    </div>
  )
}

/** Uma imagem (logo, fundo, imagem de compartilhamento). */
export function ImageField({
  id,
  label,
  description,
  path,
  onChange,
  target,
  aspect = "wide",
  fit = "cover",
  fallbackUrl,
  fallbackNote,
  error,
  disabled,
}: {
  id: string
  label: string
  description: string
  path: string | null
  onChange: (path: string | null) => void
  target: UploadTarget
  aspect?: "wide" | "square" | "logo"
  fit?: "cover" | "contain"
  /** Imagem usada quando não há upload (ex.: logo da imobiliária). */
  fallbackUrl?: string | null
  fallbackNote?: string
  error?: string
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { upload, isUploading } = useLandingAssetUpload(target)
  const url = getLandingAssetPublicUrl(path)
  const shownUrl = url ?? fallbackUrl ?? null

  async function handleFile(file: File) {
    const result = await upload(file)
    if (result.ok) onChange(result.path)
    else notifyUploadError(result.error)
  }

  return (
    <Field data-invalid={Boolean(error)} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <Thumbnail url={shownUrl} alt={label} aspect={aspect} fit={fit} />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              id={id}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Spinner data-icon="inline-start" />
              ) : path ? (
                <RefreshCwIcon data-icon="inline-start" />
              ) : (
                <UploadIcon data-icon="inline-start" />
              )}
              {isUploading ? "Enviando..." : path ? "Substituir" : "Enviar imagem"}
            </Button>
            {path ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || isUploading}
                onClick={() => onChange(null)}
              >
                <Trash2Icon data-icon="inline-start" />
                Remover
              </Button>
            ) : null}
          </div>
          {!path && fallbackNote ? (
            <span className="text-xs text-muted-foreground">{fallbackNote}</span>
          ) : null}
        </div>
      </div>
      <HiddenFileInput inputRef={inputRef} label={`Arquivo para ${label.toLowerCase()}`} onFile={handleFile} />
      {error ? <FieldError>{error}</FieldError> : <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}

/** Lista de banners, até `max`, com substituir, remover e reordenar. */
export function ImageListField({
  label,
  description,
  paths,
  max,
  onChange,
  target,
  disabled,
}: {
  label: string
  description: string
  paths: string[]
  max: number
  onChange: (paths: string[]) => void
  target: UploadTarget
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const replaceIndexRef = React.useRef<number | null>(null)
  const { upload, isUploading } = useLandingAssetUpload(target)
  const canAdd = paths.length < max

  async function handleFile(file: File) {
    const replaceIndex = replaceIndexRef.current
    replaceIndexRef.current = null

    const result = await upload(file)
    if (!result.ok) {
      notifyUploadError(result.error)
      return
    }

    if (replaceIndex != null && replaceIndex < paths.length) {
      onChange(paths.map((path, index) => (index === replaceIndex ? result.path : path)))
    } else if (paths.length < max) {
      onChange([...paths, result.path])
    }
  }

  function pick(replaceIndex: number | null) {
    replaceIndexRef.current = replaceIndex
    inputRef.current?.click()
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= paths.length) return
    const next = [...paths]
    const current = next[index]
    const swap = next[target]
    if (current === undefined || swap === undefined) return
    next[index] = swap
    next[target] = current
    onChange(next)
  }

  return (
    <Field data-disabled={disabled || undefined}>
      <div className="flex items-center justify-between gap-2">
        <FieldTitle>{label}</FieldTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {paths.length}/{max}
        </span>
      </div>
      {paths.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label={label}>
          {paths.map((path, index) => (
            <li key={path} className="flex items-center gap-3 rounded-lg border p-2">
              <Thumbnail url={getLandingAssetPublicUrl(path)} alt={`${label} ${index + 1}`} aspect="wide" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                  <span className="sr-only">Subir imagem {index + 1}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || index === paths.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                  <span className="sr-only">Descer imagem {index + 1}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || isUploading}
                  onClick={() => pick(index)}
                >
                  <RefreshCwIcon />
                  <span className="sr-only">Substituir imagem {index + 1}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || isUploading}
                  onClick={() => onChange(paths.filter((_, position) => position !== index))}
                >
                  <Trash2Icon />
                  <span className="sr-only">Remover imagem {index + 1}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {canAdd ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={disabled || isUploading}
          onClick={() => pick(null)}
        >
          {isUploading ? <Spinner data-icon="inline-start" /> : <ImagePlusIcon data-icon="inline-start" />}
          {isUploading ? "Enviando..." : "Adicionar imagem"}
        </Button>
      ) : null}
      <HiddenFileInput inputRef={inputRef} label={`Arquivo para ${label.toLowerCase()}`} onFile={handleFile} />
      <FieldDescription>{description}</FieldDescription>
    </Field>
  )
}
