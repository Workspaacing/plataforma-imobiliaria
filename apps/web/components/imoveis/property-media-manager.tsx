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

import type { ActionResult } from "@/lib/auth/action-result"
import {
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  ACCEPTED_IMAGE_TYPES,
  CAPTION_MAX_LENGTH,
  MAX_IMAGE_BYTES,
  PROPERTY_MEDIA_BUCKET,
} from "@/lib/imoveis/constants"
import { translateStorageError } from "@/lib/imoveis/db-errors"
import {
  moveMediaAction,
  registerPropertyImagesAction,
  removeMediaAction,
  setCoverMediaAction,
  updateMediaCaptionAction,
} from "@/lib/imoveis/media-actions"
import type { MediaSource } from "@/lib/imoveis/mappers"
import { getPropertyMediaPublicUrl } from "@/lib/imoveis/media-url"
import { createClient } from "@/lib/supabase/client"

const UPLOAD_CONCURRENCY = 3
const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

type UploadEntry = {
  key: string
  name: string
  status: "uploading" | "error"
  error?: string
}

/** Tipo MIME aceito (alguns sistemas não informam o tipo do arquivo; usa a extensão). */
function resolveImageType(file: File) {
  if (ACCEPTED_IMAGE_TYPES[file.type]) return file.type
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  return EXTENSION_TYPES[extension] ?? null
}

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`
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
  const url = getPropertyMediaPublicUrl(image.storage_path)
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
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={image.caption || label}
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
 * Upload direto do navegador para o bucket property-media (o RLS do Storage
 * confere se o usuário edita o imóvel) e registro das linhas via Server Action.
 */
export function PropertyMediaManager({
  organizationId,
  propertyId,
  media,
  canDelete,
}: {
  organizationId: string
  propertyId: string
  media: readonly MediaSource[]
  canDelete: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = React.useState<UploadEntry[]>([])
  const [isDragging, setIsDragging] = React.useState(false)

  const images = media
    .filter((item) => item.kind === "image" && item.storage_path)
    .sort((a, b) => a.position - b.position)
  const isUploading = uploads.some((entry) => entry.status === "uploading")

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || isUploading) return

    const rejected: string[] = []
    const accepted: { file: File; type: string; key: string }[] = []

    for (const file of files) {
      const type = resolveImageType(file)
      if (!type) {
        rejected.push(`${file.name}: formato não aceito (use JPG, PNG ou WebP)`)
      } else if (file.size > MAX_IMAGE_BYTES) {
        rejected.push(`${file.name}: ${formatMegabytes(file.size)}, acima de 7 MB`)
      } else {
        accepted.push({ file, type, key: crypto.randomUUID() })
      }
    }

    if (rejected.length > 0) {
      toast.add({
        type: "error",
        title:
          rejected.length === 1
            ? "Um arquivo foi ignorado"
            : `${rejected.length} arquivos foram ignorados`,
        description: rejected.join("; "),
      })
    }
    if (accepted.length === 0) return

    setUploads(
      accepted.map(({ file, key }) => ({
        key,
        name: file.name,
        status: "uploading",
      }))
    )

    const supabase = createClient()
    const uploadedPaths: (string | null)[] = accepted.map(() => null)
    const failures = new Map<string, string>()
    let next = 0

    async function worker() {
      while (next < accepted.length) {
        const index = next
        next += 1
        const entry = accepted[index]
        if (!entry) continue

        const extension = ACCEPTED_IMAGE_TYPES[entry.type]
        const path = `${organizationId}/properties/${propertyId}/${crypto.randomUUID()}.${extension}`
        const { error } = await supabase.storage
          .from(PROPERTY_MEDIA_BUCKET)
          .upload(path, entry.file, {
            contentType: entry.type,
            cacheControl: "31536000",
            upsert: false,
          })

        if (error) {
          failures.set(entry.key, translateStorageError(error, "enviar fotos para este imóvel"))
        } else {
          uploadedPaths[index] = path
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
        // Sem a linha no banco o arquivo ficaria órfão no bucket.
        await supabase.storage.from(PROPERTY_MEDIA_BUCKET).remove(paths)
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
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors",
          isDragging && "border-primary bg-primary/5"
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          void uploadFiles(Array.from(event.dataTransfer.files))
        }}
      >
        <ImagePlusIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Arraste as fotos para cá</p>
          <p className="text-sm text-muted-foreground">
            JPG, PNG ou WebP até 7 MB cada. Os portais exigem pelo menos 5 fotos; 15 ou mais pontuam
            o máximo na Nota do Anúncio.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <UploadIcon data-icon="inline-start" />
          )}
          {isUploading ? "Enviando..." : "Selecionar fotos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT_ATTR}
          multiple
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
                {entry.status === "uploading" ? (
                  <Spinner />
                ) : (
                  <TriangleAlertIcon className="text-destructive" />
                )}
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">{entry.name}</ItemTitle>
                <ItemDescription>
                  {entry.status === "uploading" ? "Enviando..." : entry.error}
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
          {images.length === 1 ? "1 foto" : `${images.length} fotos`}
          {images.length < 5 ? ` · faltam ${5 - images.length} para o mínimo dos portais` : ""}
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
