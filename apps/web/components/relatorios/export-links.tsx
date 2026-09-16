import { DownloadIcon } from "lucide-react"

import type { ReportPeriod } from "@workspace/core/reports/period"
import { Button } from "@workspace/ui/components/button"

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

type ExportLinksProps = {
  datasets: readonly ReportDataset[]
  period: ReportPeriod
  broker: string | null
  /** O primeiro link ganha destaque (é o relatório que está na tela). */
  emphasizeFirst?: boolean
}

export function ExportLinks({
  datasets,
  period,
  broker,
  emphasizeFirst = false,
}: ExportLinksProps) {
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
