"use client"

import Link from "next/link"
import { CircleCheckIcon, InfoIcon, RotateCcwIcon } from "lucide-react"

import type { ImportKind } from "@workspace/core/import/fields"
import type { ImportRowProblem, ImportSummary } from "@workspace/core/import/report"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item"

import { ProblemList } from "@/components/importacao/problem-list"
import { IMPORT_LIST_PATHS } from "@/lib/importacao/constants"

const LIST_LABELS: Record<ImportKind, string> = {
  clients: "Ver clientes",
  leads: "Ver leads",
  properties: "Ver imóveis",
}

function formatCount(value: number) {
  return value.toLocaleString("pt-BR")
}

export function ResultStep({
  kind,
  summary,
  problems,
  onDownloadErrors,
  onRestart,
}: {
  kind: ImportKind
  summary: ImportSummary
  problems: readonly ImportRowProblem[]
  onDownloadErrors: () => void
  onRestart: () => void
}) {
  const errors = problems.filter((problem) => problem.status === "failed")
  const stats = [
    { label: "Importados", value: summary.inserted },
    { label: "Atualizados", value: summary.updated },
    { label: "Ignorados (já existiam ou repetidos)", value: summary.skipped },
    { label: "Com erro", value: summary.failed },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <CircleCheckIcon />
        <AlertTitle>Importação concluída</AlertTitle>
        <AlertDescription>
          {formatCount(summary.totalRows)} {summary.totalRows === 1 ? "linha lida" : "linhas lidas"}
          . A importação ficou registrada na auditoria, só com as contagens.
        </AlertDescription>
      </Alert>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Item key={stat.label} variant="muted" size="sm">
            <ItemContent>
              <ItemTitle className="tabular-nums">{formatCount(stat.value)}</ItemTitle>
              <ItemDescription>{stat.label}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </div>

      {summary.drafts > 0 ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>
            {formatCount(summary.drafts)}{" "}
            {summary.drafts === 1
              ? "imóvel entrou como rascunho"
              : "imóveis entraram como rascunho"}
          </AlertTitle>
          <AlertDescription>
            Faltou preço ou área para ficar ativo. Complete no cadastro do imóvel e mude a situação
            para ativo.
          </AlertDescription>
        </Alert>
      ) : null}

      {errors.length > 0 ? (
        <section aria-labelledby="importacao-resultado-erros" className="flex flex-col gap-3">
          <h2 id="importacao-resultado-erros" className="text-base font-medium">
            Linhas com erro
          </h2>
          <ProblemList
            problems={errors}
            onDownload={onDownloadErrors}
            downloadLabel="Baixar CSV de erros"
          />
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onRestart}>
          <RotateCcwIcon data-icon="inline-start" />
          Importar outra planilha
        </Button>
        <Button render={<Link href={IMPORT_LIST_PATHS[kind]} />} nativeButton={false}>
          {LIST_LABELS[kind]}
        </Button>
      </div>
    </div>
  )
}
