import { ChevronDownIcon, ClockAlertIcon, SirenIcon, WrenchIcon } from "lucide-react"

import { INCIDENT_KIND_LABELS, isClosedIncidentStatus } from "@workspace/core/status/incidents"
import { INCIDENT_STATUS_LABELS } from "@workspace/core/status/public"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"

import { IncidentEditDialog } from "@/components/plataforma/status/incident-edit-dialog"
import { IncidentUpdateDialog } from "@/components/plataforma/status/incident-update-dialog"
import { statusComponentNames } from "@/components/plataforma/status/status-format"
import {
  IncidentImpactBadge,
  IncidentStatusBadge,
} from "@/components/plataforma/status/status-level-badge"
import { formatDateTime } from "@/lib/format"
import type { StatusConsoleIncident, StatusConsoleIncidentUpdate } from "@/lib/status/console"

/** Atualizações mostradas abertas; as mais antigas ficam recolhidas. */
const VISIBLE_UPDATES = 3

function UpdateList({ updates }: { updates: readonly StatusConsoleIncidentUpdate[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {updates.map((update) => (
        <li key={update.id} className="flex min-w-0 flex-col gap-1 border-s-2 ps-3">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium">{INCIDENT_STATUS_LABELS[update.status]}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDateTime(update.createdAt)}
            </span>
          </span>
          <span className="break-words whitespace-pre-line">{update.message}</span>
        </li>
      ))}
    </ol>
  )
}

function UpdatesTimeline({ updates }: { updates: readonly StatusConsoleIncidentUpdate[] }) {
  if (updates.length === 0) {
    return <p className="text-muted-foreground">Nenhuma atualização publicada.</p>
  }

  const visible = updates.slice(0, VISIBLE_UPDATES)
  const older = updates.slice(VISIBLE_UPDATES)

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted-foreground">
        Linha do tempo (mais recente primeiro)
      </span>
      <UpdateList updates={visible} />
      {older.length > 0 ? (
        <Collapsible className="flex flex-col gap-3">
          <CollapsibleTrigger
            render={<Button variant="ghost" size="sm" className="group/trigger self-start" />}
          >
            <ChevronDownIcon
              data-icon="inline-start"
              className="transition-transform group-data-[panel-open]/trigger:rotate-180"
            />
            {older.length === 1
              ? "Mostrar 1 atualização anterior"
              : `Mostrar ${older.length} atualizações anteriores`}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <UpdateList updates={older} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}

function periodFacts(incident: StatusConsoleIncident): { label: string; value: string }[] {
  const facts = [{ label: "Partes afetadas", value: statusComponentNames(incident.componentKeys) }]

  if (incident.kind === "maintenance") {
    facts.push({
      label: "Janela prevista",
      value: `${formatDateTime(incident.scheduledFor)} até ${formatDateTime(incident.scheduledUntil)}`,
    })
  }

  facts.push({ label: "Início", value: formatDateTime(incident.startedAt) })

  if (incident.resolvedAt) {
    facts.push({
      label: incident.kind === "maintenance" ? "Concluída em" : "Resolvido em",
      value: formatDateTime(incident.resolvedAt),
    })
  }

  return facts
}

function IncidentCard({
  incident,
  now,
  readOnly,
}: {
  incident: StatusConsoleIncident
  now: Date
  readOnly: boolean
}) {
  const closed = isClosedIncidentStatus(incident.effectiveStatus)
  const overdue =
    incident.effectiveStatus === "in_progress" &&
    incident.scheduledUntil !== null &&
    Date.parse(incident.scheduledUntil) <= now.getTime()
  const movedByClock =
    incident.kind === "maintenance" && incident.status !== incident.effectiveStatus

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={incident.kind === "maintenance" ? "secondary" : "outline"}>
            {incident.kind === "maintenance" ? (
              <WrenchIcon data-icon="inline-start" />
            ) : (
              <SirenIcon data-icon="inline-start" />
            )}
            {INCIDENT_KIND_LABELS[incident.kind]}
          </Badge>
          <IncidentStatusBadge status={incident.effectiveStatus} />
          <IncidentImpactBadge impact={incident.impact} />
        </div>
        <CardTitle className="break-words">{incident.title}</CardTitle>
        {movedByClock ? (
          <CardDescription>
            {incident.effectiveStatus === "completed"
              ? "Concluída sozinha no fim previsto (ninguém publicou “Concluída”)."
              : "Começou sozinha no início previsto."}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {overdue ? (
          <Alert>
            <ClockAlertIcon />
            <AlertTitle>Passou do fim previsto: conclua quando terminar</AlertTitle>
            <AlertDescription>
              O fim previsto era {formatDateTime(incident.scheduledUntil)}. A página pública segue
              mostrando “Em manutenção” até alguém publicar “Concluída”.
            </AlertDescription>
          </Alert>
        ) : null}
        <dl className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
          {periodFacts(incident).map((fact) => (
            <div key={fact.label} className="flex min-w-0 flex-col gap-0.5 sm:contents">
              <dt className="text-xs text-muted-foreground sm:text-sm">{fact.label}</dt>
              <dd className="min-w-0 break-words tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
        <UpdatesTimeline updates={incident.updates} />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {closed ? null : (
          <IncidentUpdateDialog
            incidentId={incident.id}
            title={incident.title}
            kind={incident.kind}
            status={incident.effectiveStatus}
            readOnly={readOnly}
          />
        )}
        <IncidentEditDialog
          incidentId={incident.id}
          kind={incident.kind}
          status={incident.effectiveStatus}
          title={incident.title}
          impact={incident.impact}
          componentKeys={incident.componentKeys}
          scheduledFor={incident.scheduledFor}
          scheduledUntil={incident.scheduledUntil}
          readOnly={readOnly}
        />
      </CardFooter>
    </Card>
  )
}

export function IncidentsSection({
  title,
  description,
  incidents,
  now,
  readOnly = false,
}: {
  title: string
  description: string
  incidents: readonly StatusConsoleIncident[]
  now: Date
  /** Somente leitura: botões de ação desabilitados (o servidor recusa de qualquer jeito). */
  readOnly?: boolean
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {incidents.map((incident) => (
          <li key={incident.id} className="min-w-0">
            <IncidentCard incident={incident} now={now} readOnly={readOnly} />
          </li>
        ))}
      </ul>
    </section>
  )
}
