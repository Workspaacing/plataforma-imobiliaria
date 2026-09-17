import { DownloadIcon, LockIcon } from "lucide-react"

import type { ReportPeriod } from "@workspace/core/reports/period"
import { Button } from "@workspace/ui/components/button"

import { requireMembership } from "@/lib/auth/session"
import { getExportRoles } from "@/lib/configuracoes/export-audit"
import { canExportData, exportDeniedMessage } from "@/lib/configuracoes/export-permissions"
import { REPORT_DATASET_LABELS, type ReportDataset } from "@/lib/relatorios/datasets"
import { reportPeriodParams } from "@/lib/relatorios/url"

/**
 * Links de download. São `<a>` de verdade (não fetch) para o navegador cuidar
 * do arquivo: a rota transmite o CSV em pedaços, e o download começa antes de o
 * banco terminar de ler.
 *
 * Os parâmetros são os MESMOS da tela, então a planilha traz exatamente o
 * período e o corretor que estavam sendo lidos.
 */
export function exportHref(
  dataset: ReportDataset,
  period: ReportPeriod,
  broker: string | null
): string {
  const params = reportPeriodParams(period)

  if (broker) {
    params.set("corretor", broker)
  }

  return `/api/relatorios/${dataset}?${params.toString()}`
}

/** A base (dados de pessoas) explica a recusa; o relatório agregado só some. */
const BASE_DATASETS: readonly ReportDataset[] = ["leads", "imoveis", "clientes", "propostas"]

type ExportLinksProps = {
  datasets: readonly ReportDataset[]
  period: ReportPeriod
  broker: string | null
  /** O primeiro link ganha destaque (é o relatório que está na tela). */
  emphasizeFirst?: boolean
  /**
   * O que mostrar quando o papel não exporta: um aviso dizendo quem libera, ou
   * nada. Padrão: aviso quando há conjunto da base, nada no cabeçalho dos
   * relatórios agregados.
   */
  deniedNotice?: boolean
}

/**
 * Só desenha os botões para quem exporta (configuração do dono em
 * /configuracoes/permissoes). É conforto de tela: a rota responde 403 e o
 * banco recusa a página para quem não pode, com ou sem botão.
 */
export async function ExportLinks({
  datasets,
  period,
  broker,
  emphasizeFirst = false,
  deniedNotice,
}: ExportLinksProps) {
  const { membership } = await requireMembership()
  const exportRoles = await getExportRoles(membership.organizationId)

  if (!canExportData(membership.role, exportRoles)) {
    const showNotice = deniedNotice ?? datasets.some((dataset) => BASE_DATASETS.includes(dataset))

    return showNotice ? (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{exportDeniedMessage(exportRoles)}</span>
      </p>
    ) : null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {datasets.map((dataset, index) => (
        <Button
          key={dataset}
          variant={emphasizeFirst && index === 0 ? "outline" : "ghost"}
          size="sm"
          nativeButton={false}
          render={
            // `download` só sugere o nome; quem manda é o Content-Disposition.
            <a href={exportHref(dataset, period, broker)} download />
          }
        >
          <DownloadIcon data-icon="inline-start" />
          {REPORT_DATASET_LABELS[dataset]}
        </Button>
      ))}
    </div>
  )
}
