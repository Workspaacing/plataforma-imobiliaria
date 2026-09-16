import { ExternalLinkIcon, InfoIcon } from "lucide-react"

import { CAIXA_DOWNLOAD_PAGE_URL, CAIXA_SOURCE_LABEL } from "@workspace/core/caixa/source"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"

import type { CaixaCatalogStatus } from "@/lib/caixa/list-queries"
import { formatDate, formatDateTime } from "@/lib/format"

/**
 * Aviso de origem, em toda tela do módulo.
 *
 * O texto diz o que é verdade e só isso: a informação é da Caixa, o que está
 * aqui é uma cópia, ela pode estar desatualizada e a fonte oficial é o site
 * dela. Não promete periodicidade ("atualizado todo dia") — o CRM verifica de
 * meia em meia hora, mas quem decide quando o arquivo muda é a Caixa, e até
 * agora só um ciclo de geração foi observado. O que a tela mostra é o fato:
 * quando o catálogo mudou pela última vez.
 */
export function CaixaSourceNotice({ status }: { status: CaixaCatalogStatus | null }) {
  const generatedOn = status?.lista_gerada_em ? formatDate(status.lista_gerada_em) : null
  const changedAt = status?.last_changed_at ? formatDateTime(status.last_changed_at) : null
  const checkedAt = status?.last_checked_at ? formatDateTime(status.last_checked_at) : null

  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>
        {generatedOn
          ? `Fonte: ${CAIXA_SOURCE_LABEL} — lista de ${generatedOn}`
          : `Fonte: ${CAIXA_SOURCE_LABEL}`}
      </AlertTitle>
      <AlertDescription>
        <p>
          Esta é uma cópia da lista pública de imóveis que a Caixa vende. O CRM verifica de tempos
          em tempos se a lista mudou, mas <strong>ela pode estar desatualizada</strong>: valores,
          prazos e a própria disponibilidade mudam no site da Caixa, que é a fonte oficial. Confirme
          lá antes de prometer qualquer coisa a um cliente.
        </p>
        <p className="text-xs">
          {changedAt
            ? `Nossa cópia mudou pela última vez em ${changedAt}.`
            : "A nossa cópia ainda não foi atualizada nenhuma vez."}
          {checkedAt ? ` Última verificação: ${checkedAt}.` : ""}{" "}
          <a
            href={CAIXA_DOWNLOAD_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            Lista oficial da Caixa
            <ExternalLinkIcon className="size-3" />
          </a>
        </p>
      </AlertDescription>
    </Alert>
  )
}
