"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImagePlusIcon,
  StarIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"

import { formatSizeChange } from "@workspace/core/media/format"
import { SOURCE_IMAGE_ACCEPT, detectFileKind } from "@workspace/core/media/image-type"
import { MAX_PROPERTY_PHOTOS, splitByPhotoLimit } from "@workspace/core/media/limits"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { FallbackImage } from "@/components/media/fallback-image"
import { UploadsBlockedNotice } from "@/components/media/uploads-blocked-notice"
import type { ActionResult } from "@/lib/auth/action-result"
import { CAPTION_MAX_LENGTH, MAX_IMAGE_BYTES, PROPERTY_MEDIA_BUCKET } from "@/lib/imoveis/constants"
import { translateStorageError } from "@/lib/imoveis/db-errors"
import {
  moveMediaAction,
  registerPropertyImagesAction,
  removeMediaAction,
  setCoverMediaAction,
  updateMediaCaptionAction,
} from "@/lib/imoveis/media-actions"
import type { MediaSource } from "@/lib/imoveis/mappers"
import { getImagePreparationMessage, prepareImage } from "@/lib/media/compress-image"
import { getPropertyPhotoUrls, propertyPhotoObjectPaths, thumbPathFor } from "@/lib/media/paths"
import { UPLOADS_BLOCKED_MESSAGE, isStorageForbiddenError } from "@/lib/media/upload-errors"
import { createClient } from "@/lib/supabase/client"

/** Otimizar e enviar no máximo 2 fotos ao mesmo tempo: não trava o celular. */
const UPLOAD_CONCURRENCY = 2
const STORAGE_CACHE_CONTROL = "31536000"
const PHOTO_SIZES = "(min-width: 1280px) 20rem, (min-width: 640px) 50vw, 100vw"

type UploadStatus = "queued" | "optimizing" | "uploading" | "error"

type UploadEntry = {
  key: string
  name: string
  status: UploadStatus
  /** "2,8 MB → 240 KB" depois da otimização. */
  sizeLabel?: string
  error?: string
}

const STATUS_LABELS: Record<Exclude<UploadStatus, "error">, string> = {
  queued: "Na fila…",
  optimizing: "Otimizando…",
  uploading: "Enviando…",
}

function notify(result: ActionResult, { quiet = false }: { quiet?: boolean } = {}) {
  if (!result.ok) {
    toast.add({
      type: "error",
      title: "Não foi possível concluir",
      description: result.error,
    })
  } else if (!quiet && result.message) {
    toast.add({ type: "success", title: result.message })
  }
}

function MediaCard({
  propertyId,
  image,
  index,
  total,
  canDelete,
}: {
  propertyId: string
  image: MediaSource
  index: number
  total: number
  canDelete: boolean
}) {
  const [caption, setCaption] = React.useState(image.caption ?? "")
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const photo = getPropertyPhotoUrls(image.storage_path)
  const captionChanged = caption.trim() !== (image.caption ?? "")
  const label = `Foto ${index + 1}`

  function run(action: () => Promise<ActionResult>, options?: { quiet?: boolean }) {
    startTransition(async () => {
      notify(await action(), options)
    })
  }

  function saveCaption() {
    if (!captionChanged) return
    run(() => updateMediaCaptionAction(propertyId, image.id, caption))
  }

  return (
    <Card size="sm" className="h-full">
      {photo.main ? (
        <FallbackImage
          src={photo.main}
          srcSet={photo.srcSet}
          sizes={PHOTO_SIZES}
          fallbackSrc={photo.main}
          alt={image.caption || label}
          width={1600}
          height={1200}
          loading="lazy"
          decoding="async"
          className="aspect-4/3 w-full object-cover"
        />
      ) : null}
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardAction>
          {image.is_cover ? (
            <Badge>
              <StarIcon data-icon="inline-start" />
              Capa
            </Badge>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor={`legenda-${image.id}`} className="sr-only">
            Legenda da {label.toLowerCase()}
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={`legenda-${image.id}`}
              value={caption}
              maxLength={CAPTION_MAX_LENGTH}
              placeholder="Legenda (ex.: Sala com varanda)"
              disabled={isPending}
              onChange={(event) => setCaption(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  saveCaption()
                }
              }}
            />
            {captionChanged ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton onClick={saveCaption} disabled={isPending}>
                  Salvar
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </Field>
      </CardContent>
      <CardFooter className="flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Subir"
          disabled={isPending || index === 0}
          onClick={() =>
            run(() => moveMediaAction(propertyId, image.id, "up"), {
              quiet: true,
            })
          }
        >
          <ArrowUpIcon />
          <span className="sr-only">Subir {label.toLowerCase()}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Descer"
          disabled={isPending || index === total - 1}
          onClick={() =>
            run(() => moveMediaAction(propertyId, image.id, "down"), {
              quiet: true,
            })
          }
        >
          <ArrowDownIcon />
          <span className="sr-only">Descer {label.toLowerCase()}</span>
        </Button>
        {image.is_cover ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => run(() => setCoverMediaAction(propertyId, image.id))}
          >
            <StarIcon data-icon="inline-start" />
            Definir capa
          </Button>
        )}
        {canDelete ? (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger
              render={<Button type="button" variant="ghost" size="sm" disabled={isPending} />}
            >
              <Trash2Icon data-icon="inline-start" />
              Remover
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover a {label.toLowerCase()}?</AlertDialogTitle>
                <AlertDialogDescription>
                  A foto sai do anúncio e o arquivo é apagado do armazenamento. Não dá para
                  desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    setConfirmOpen(false)
                    run(() => removeMediaAction(propertyId, image.id))
                  }}
                >
                  Remover foto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        {isPending ? <Spinner className="ms-auto" /> : null}
      </CardFooter>
    </Card>
  )
}

/**
 * Fotos do imóvel. Cada arquivo é otimizado no navegador (JPEG de até 1600 px,
 * sem EXIF/GPS) e ganha uma miniatura WebP de 400 px (`__thumb.webp`) antes de
 * ir direto para o bucket property-media (o RLS do Storage confere se o usuário
 * edita o imóvel). As linhas são registradas depois via Server Action.
 */
export function PropertyMediaManager({
  organizationId,
  propertyId,
  media,
  canDelete,
  uploadsBlocked = false,
}: {
  organizationId: string
  propertyId: string
  media: readonly MediaSource[]
  canDelete: boolean
  /** Assinatura em modo leitura: o Storage recusa novos arquivos. */
  uploadsBlocked?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = React.useState<UploadEntry[]>([])
  const [summary, setSummary] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  const images = media
    .filter((item) => item.kind === "image" && item.storage_path)
    .sort((a, b) => a.position - b.position)
  const isUploading = uploads.some((entry) => entry.status !== "error")
  const isFull = images.length >= MAX_PROPERTY_PHOTOS
  const canAdd = !uploadsBlocked && !isFull

  function updateEntry(key: string, patch: Partial<UploadEntry>) {
    setUploads((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry))
    )
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || isUploading) return

    if (uploadsBlocked) {
      toast.add({ type: "error", title: "Envio bloqueado", description: UPLOADS_BLOCKED_MESSAGE })
      return
    }

    const rejected: string[] = []
    const candidates: { file: File; key: string }[] = []

    for (const file of files) {
      const kind = detectFileKind(file)
      // Formato desconhecido segue: a assinatura do arquivo é conferida na otimização.
      if (kind === "svg" || kind === "pdf") {
        rejected.push(`${file.name}: formato não aceito (use JPG, PNG, WebP ou HEIC)`)
      } else {
        candidates.push({ file, key: crypto.randomUUID() })
      }
    }

    const limit = splitByPhotoLimit(images.length, candidates.length)
    const accepted = candidates.slice(0, limit.accepted)

    if (limit.rejected > 0) {
      rejected.push(
        limit.remaining === 0
          ? `o imóvel já tem ${MAX_PROPERTY_PHOTOS} fotos, o máximo permitido`
          : `${limit.rejected === 1 ? "1 foto ficou" : `${limit.rejected} fotos ficaram`} de fora: o máximo é ${MAX_PROPERTY_PHOTOS} por imóvel`
      )
    }

    if (rejected.length > 0) {
      const ignored = files.length - accepted.length
      toast.add({
        type: "error",
        title: ignored === 1 ? "Um arquivo foi ignorado" : `${ignored} arquivos foram ignorados`,
        description: rejected.join("; "),
      })
    }
    if (accepted.length === 0) return

    setSummary(null)
    setUploads(accepted.map(({ file, key }) => ({ key, name: file.name, status: "queued" })))

    const supabase = createClient()
    const bucket = supabase.storage.from(PROPERTY_MEDIA_BUCKET)
    const uploadedPaths: (string | null)[] = accepted.map(() => null)
    const failures = new Map<string, string>()
    let beforeBytes = 0
    let afterBytes = 0
    let blocked = false
    let next = 0

    async function processEntry(index: number) {
      const entry = accepted[index]
      if (!entry) return

      if (blocked) {
        failures.set(entry.key, UPLOADS_BLOCKED_MESSAGE)
        return
      }

      updateEntry(entry.key, { status: "optimizing" })

      let prepared: Awaited<ReturnType<typeof prepareImage>>
      try {
        prepared = await prepareImage(entry.file, "propertyPhoto", { thumbnail: true })
      } catch (error) {
        failures.set(entry.key, getImagePreparationMessage(error))
        return
      }

      const { main, thumb } = prepared
      if (main.bytes > MAX_IMAGE_BYTES) {
        failures.set(entry.key, "Mesmo otimizada, a foto passou do limite. Tente outra foto.")
        return
      }

      updateEntry(entry.key, {
        status: "uploading",
        sizeLabel: formatSizeChange(entry.file.size, main.bytes),
      })

      const path = `${organizationId}/properties/${propertyId}/${crypto.randomUUID()}.${main.extension}`
      const { error } = await bucket.upload(path, main.blob, {
        contentType: main.type,
        cacheControl: STORAGE_CACHE_CONTROL,
        upsert: false,
      })

      if (error) {
        if (isStorageForbiddenError(error)) {
          blocked = true
          failures.set(entry.key, UPLOADS_BLOCKED_MESSAGE)
        } else {
          failures.set(entry.key, translateStorageError(error, "enviar fotos para este imóvel"))
        }
        return
      }

      uploadedPaths[index] = path
      beforeBytes += entry.file.size
      afterBytes += main.bytes

      if (thumb) {
        // Sem miniatura a UI usa a foto principal; não vale perder a foto por isso.
        await bucket.upload(thumbPathFor(path), thumb.blob, {
          contentType: thumb.type,
          cacheControl: STORAGE_CACHE_CONTROL,
          upsert: false,
        })
      }
    }

    async function worker() {
      while (next < accepted.length) {
        const index = next
        next += 1
        const entry = accepted[index]
        try {
          await processEntry(index)
        } catch {
          if (entry) failures.set(entry.key, "Falha no envio. Verifique a conexão e tente de novo.")
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, accepted.length) }, () => worker())
    )

    const paths = uploadedPaths.filter((path): path is string => path !== null)

    if (paths.length > 0) {
      const result = await registerPropertyImagesAction(propertyId, paths)
      if (!result.ok) {
        // Sem a linha no banco a foto e a miniatura ficariam órfãs no bucket.
        await bucket.remove(paths.flatMap(propertyPhotoObjectPaths))
      } else {
        setSummary(
          `${paths.length === 1 ? "1 foto otimizada" : `${paths.length} fotos otimizadas`}: ${formatSizeChange(beforeBytes, afterBytes)}`
        )
      }
      notify(result)
    }

    setUploads(
      accepted
        .filter(({ key }) => failures.has(key))
        .map(({ file, key }) => ({
          key,
          name: file.name,
          status: "error",
          error: failures.get(key),
        }))
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {uploadsBlocked ? <UploadsBlockedNotice /> : null}

      <div
        aria-disabled={!canAdd || undefined}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors",
          isDragging && canAdd && "border-primary bg-primary/5",
          !canAdd && "opacity-60"
        )}
        onDragOver={(event) => {
          event.preventDefault()
          if (canAdd) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          if (!uploadsBlocked && isFull) {
            toast.add({
              type: "error",
              title: `Limite de ${MAX_PROPERTY_PHOTOS} fotos atingido`,
              description: "Remova uma foto para enviar outra.",
            })
            return
          }
          void uploadFiles(Array.from(event.dataTransfer.files))
        }}
      >
        <ImagePlusIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {isFull
              ? `Limite de ${MAX_PROPERTY_PHOTOS} fotos atingido`
              : "Arraste as fotos para cá"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isFull
              ? "Remova uma foto para enviar outra."
              : "JPG, PNG, WebP ou HEIC. Cada foto é otimizada no navegador antes do envio (até 1600 px, sem dados de localização). Os portais exigem pelo menos 5 fotos; 15 ou mais pontuam o máximo na Nota do Anúncio."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isUploading || !canAdd}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <UploadIcon data-icon="inline-start" />
          )}
          {isUploading ? "Processando fotos…" : "Selecionar fotos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={SOURCE_IMAGE_ACCEPT}
          multiple
          disabled={!canAdd}
          className="sr-only"
          tabIndex={-1}
          aria-label="Selecionar fotos do imóvel"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ""
            void uploadFiles(files)
          }}
        />
      </div>

      {uploads.length > 0 ? (
        <ItemGroup className="gap-2" aria-live="polite">
          {uploads.map((entry) => (
            <Item key={entry.key} variant="outline" size="xs">
              <ItemMedia variant="icon">
                {entry.status === "error" ? (
                  <TriangleAlertIcon className="text-destructive" />
                ) : (
                  <Spinner />
                )}
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">{entry.name}</ItemTitle>
                <ItemDescription>
                  {entry.status === "error"
                    ? entry.error
                    : `${STATUS_LABELS[entry.status]}${entry.sizeLabel ? ` · ${entry.sizeLabel}` : ""}`}
                </ItemDescription>
              </ItemContent>
              {entry.status === "error" ? (
                <ItemActions>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setUploads((current) => current.filter((item) => item.key !== entry.key))
                    }
                  >
                    <XIcon />
                    <span className="sr-only">Dispensar aviso de {entry.name}</span>
                  </Button>
                </ItemActions>
              ) : null}
            </Item>
          ))}
        </ItemGroup>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">
          {images.length} de {MAX_PROPERTY_PHOTOS} fotos
          {images.length < 5 ? ` · faltam ${5 - images.length} para o mínimo dos portais` : ""}
          {summary ? <span className="block text-xs tabular-nums">{summary}</span> : null}
        </span>
        {canDelete ? null : <span>Somente o dono ou o gerente podem remover fotos.</span>}
      </div>

      {images.length > 0 ? (
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Fotos do imóvel"
        >
          {images.map((image, index) => (
            <li key={image.id}>
              <MediaCard
                key={`${image.id}-${image.caption ?? ""}`}
                propertyId={propertyId}
                image={image}
                index={index}
                total={images.length}
                canDelete={canDelete}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
