import type { NextRequest } from "next/server"
import { z } from "zod"

import { csvFileName } from "@workspace/core/reports/csv"
import { resolveReportPeriod } from "@workspace/core/reports/period"

import { requireMembership } from "@/lib/auth/session"
import {
  isReportDataset,
  REPORT_CSV_DATASETS,
  reportDatasetFilePrefix,
} from "@/lib/relatorios/datasets"
import { csvResponse } from "@/lib/relatorios/export"

/**
 * Download em CSV dos relatórios e da base, em `/api/relatorios/<recurso>`.
 *
 * `recurso` é um dos nomes de `REPORT_DATASETS`; qualquer outra coisa é 404
 * (nada de mensagem dizendo o que existe). O período e o corretor vêm da URL
 * nos mesmos parâmetros da tela, então o arquivo bate com o que estava sendo
 * lido quando o botão foi clicado.
 *
 * Quem decide o conteúdo é o banco: as RPCs são `security invoker` (as linhas
 * saem do RLS da sessão) e o recorte por papel acontece dentro delas — um
 * corretor baixa só o que já enxerga, e sem as colunas sensíveis. Esta rota não
 * afrouxa nada: ela só exige membership ativa e transmite.
 */

const NOT_FOUND_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recurso: string }> }
) {
  const [{ membership }, { recurso }] = await Promise.all([requireMembership(), params])

  if (!isReportDataset(recurso)) {
    return new Response(null, { status: 404, headers: NOT_FOUND_HEADERS })
  }

  const search = request.nextUrl.searchParams
  const period = resolveReportPeriod({
    preset: search.get("periodo"),
    from: search.get("de"),
    to: search.get("ate"),
  })

  // Corretor inválido vira "toda a equipe"; quem não pode ver a equipe é
  // recortado pela RPC de qualquer jeito.
  const rawBroker = search.get("corretor")
  const broker = rawBroker && z.guid().safeParse(rawBroker).success ? rawBroker : null

  const dataset = REPORT_CSV_DATASETS[recurso]
  const body = dataset.stream({
    organizationId: membership.organizationId,
    period,
    broker,
  })

  return csvResponse(csvFileName(reportDatasetFilePrefix(recurso), period), body)
}
