"use client"

import * as React from "react"
import { DownloadIcon, FileTextIcon, LockIcon, UploadIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"

import { ConfirmDeleteButton } from "@/components/clientes/confirm-delete-button"
import { formatDateTime } from "@/lib/format"
import {
  CLIENT_DOCUMENT_MAX_BYTES,
  CLIENT_DOCUMENT_MIME_TYPES,
  CLIENT_DOCUMENTS_BUCKET,
} from "@/lib/clientes/constants"
import {
  deleteClientDocument,
  getClientDocumentDownloadUrl,
  registerClientDocument,
} from "@/lib/clientes/document-actions"
import {
  buildClientDocumentPath,
  formatFileSize,
  getDocumentKindLabel,
  isAllowedDocumentMimeType,
} from "@/lib/clientes/documents"
import { createClient } from "@/lib/supabase/client"

export type DocumentRowView = {
  id: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedByName: string
  createdAt: string
}

type DocumentsPanelProps = {
  clientId: string
  organizationId: string
  documents: DocumentRowView[]
  canUpload: boolean
  canDelete: boolean
}

function describeStorageError(error: { message: string }) {
  const message = error.message.toLowerCase()

  if (
    message.includes("row-level security") ||
    message.includes("unauthorized") ||
    message.includes("403")
  ) {
    return "Você não tem permissão para enviar documentos deste cliente."
  }

  if (message.includes("size") || message.includes("too large") || message.includes("413")) {
    return "O arquivo passa do limite de 20 MB."
  }

  if (message.includes("mime") || message.includes("type")) {
    return "Formato não aceito. Envie PDF, JPG, PNG ou WebP."
  }

  return "Falha no envio. Verifique a conexão e tente de novo."
}

export function DocumentsPanel({
  clientId,
  organizationId,
  documents,
  canUpload,
  canDelete,
}: DocumentsPanelProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isUploading, startUpload] = React.useTransition()
  const [isDownloading, startDownload] = React.useTransition()
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)

  function uploadFiles(files: File[]) {
    startUpload(async () => {
      const supabase = createClient()
      let uploaded = 0

      for (const file of files) {
        const mimeType = file.type

        if (!isAllowedDocumentMimeType(mimeType)) {
          toast.add({
            title: `"${file.name}" não foi enviado`,
            description: "Formato não aceito. Envie PDF, JPG, PNG ou WebP.",
            type: "error",
          })
          continue
        }

        if (file.size === 0 || file.size > CLIENT_DOCUMENT_MAX_BYTES) {
          toast.add({
            title: `"${file.name}" não foi enviado`,
            description:
              file.size === 0 ? "O arquivo está vazio." : "O arquivo passa do limite de 20 MB.",
            type: "error",
          })
          continue
        }

        const path = buildClientDocumentPath(
          organizationId,
          clientId,
          file.name,
          crypto.randomUUID()
        )
        const { error: uploadError } = await supabase.storage
          .from(CLIENT_DOCUMENTS_BUCKET)
          .upload(path, file, { contentType: mimeType, upsert: false })

        if (uploadError) {
          toast.add({
            title: `"${file.name}" não foi enviado`,
            description: describeStorageError(uploadError),
            type: "error",
          })
          continue
        }

        const result = await registerClientDocument({
          clientId,
          storagePath: path,
          name: file.name.slice(0, 200),
          mimeType,
          sizeBytes: file.size,
        })

        if (!result.ok) {
          // Tenta não deixar arquivo órfão (só dono/gerente conseguem remover pelo RLS).
          await supabase.storage.from(CLIENT_DOCUMENTS_BUCKET).remove([path])
          toast.add({
            title: `"${file.name}" não foi registrado`,
            description: result.error,
            type: "error",
          })
          continue
        }

        uploaded += 1
      }

      if (uploaded > 0) {
        toast.add({
          title: uploaded === 1 ? "Documento enviado." : `${uploaded} documentos enviados.`,
          type: "success",
        })
      }
    })
  }

  function download(documentId: string) {
    setDownloadingId(documentId)

    startDownload(async () => {
      const result = await getClientDocumentDownloadUrl(documentId)
      setDownloadingId(null)

      if (!result.ok) {
        toast.add({ title: result.error, type: "error" })
        return
      }

      // URL assinada com Content-Disposition de download: não sai da página.
      window.location.assign(result.data.url)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <LockIcon />
        <AlertTitle>Documentos privados</AlertTitle>
        <AlertDescription>
          Os arquivos ficam em armazenamento privado. Cada download usa um link temporário e fica
          registrado com o seu usuário (LGPD).
        </AlertDescription>
      </Alert>

      {canUpload ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">PDF, JPG, PNG ou WebP, até 20 MB cada.</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={CLIENT_DOCUMENT_MIME_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ""
              if (files.length > 0) uploadFiles(files)
            }}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={isUploading}>
            {isUploading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UploadIcon data-icon="inline-start" />
            )}
            {isUploading ? "Enviando…" : "Enviar documentos"}
          </Button>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum documento</EmptyTitle>
            <EmptyDescription>
              RG, CPF, comprovantes de renda e de residência e o termo de consentimento ficam aqui.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Enviado por</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-end">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="max-w-72">
                    <span className="block truncate font-medium" title={document.name}>
                      {document.name}
                    </span>
                  </TableCell>
                  <TableCell>{getDocumentKindLabel(document.mimeType)}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatFileSize(document.sizeBytes)}
                  </TableCell>
                  <TableCell>{document.uploadedByName}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateTime(document.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => download(document.id)}
                        disabled={isDownloading}
                      >
                        {isDownloading && downloadingId === document.id ? (
                          <Spinner />
                        ) : (
                          <DownloadIcon />
                        )}
                        <span className="sr-only">Baixar {document.name}</span>
                      </Button>
                      {canDelete ? (
                        <ConfirmDeleteButton
                          action={() => deleteClientDocument(document.id, clientId)}
                          label={`Remover ${document.name}`}
                          title="Remover este documento?"
                          description="O arquivo é apagado do armazenamento. Esta ação não pode ser desfeita."
                          confirmLabel="Remover"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
