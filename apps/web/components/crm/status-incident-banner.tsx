import { ActivityIcon, WrenchIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"

import { getActiveIncidentHeadline } from "@/components/status/format"
import { getStatusPageHref } from "@/components/status/links"
import { getPublicStatus } from "@/lib/status/public"

async function loadSnapshot() {
  try {
    return await getPublicStatus()
  } catch (cause) {
    console.error(
      `[crm] status público indisponível para a faixa (${cause instanceof Error ? cause.name : "erro"})`
    )
    return null
  }
}

/**
 * Faixa discreta no topo do CRM enquanto há incidente ou manutenção em
 * andamento, com link para a página de status (nova aba). Sem retrato, com
 * falha ou sem nada em andamento, não renderiza nada: um aviso nunca derruba
 * a página. Usar dentro de <Suspense fallback={null}> no layout do CRM.
 */
export async function StatusIncidentBanner() {
  const snapshot = await loadSnapshot()
  const headline = snapshot ? getActiveIncidentHeadline(snapshot) : null

  if (!snapshot || !headline) {
    return null
  }

  const isMaintenanceOnly = snapshot.activeIncidents.every(
    (incident) => incident.kind === "maintenance"
  )
  const Icon = isMaintenanceOnly ? WrenchIcon : ActivityIcon

  return (
    <div className="px-4 pt-4 lg:px-6">
      <Alert role="status">
        <Icon />
        <AlertTitle>{headline}</AlertTitle>
        <AlertDescription>
          <a href={getStatusPageHref()} target="_blank" rel="noopener">
            Acompanhe em Status do sistema
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </AlertDescription>
      </Alert>
    </div>
  )
}
