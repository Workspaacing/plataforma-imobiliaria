import Link from "next/link"
import { RadarIcon } from "lucide-react"

import { STATUS_LEVEL_LABELS, type PublicStatusSnapshot } from "@workspace/core/status/public"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { StatusLevelBadge } from "@/components/plataforma/status/status-level-badge"
import { formatNumber } from "@/lib/format"
import { PLATFORM_STATUS_PATH } from "@/lib/status/console"

/**
 * Atalho da Saúde do sistema para o status público: a situação que os clientes
 * veem (retrato com cache, o mesmo da página /status) e o que está em aberto.
 */
export function PublicStatusSummaryCard({ snapshot }: { snapshot: PublicStatusSnapshot | null }) {
  const openIncidents =
    snapshot?.activeIncidents.filter((incident) => incident.kind === "incident").length ?? 0
  const runningMaintenances =
    snapshot?.activeIncidents.filter((incident) => incident.kind === "maintenance").length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status público</CardTitle>
        <CardDescription>
          {snapshot
            ? `O que os clientes veem em /status: ${STATUS_LEVEL_LABELS[snapshot.overall]}.`
            : "Não foi possível ler o status público agora."}
        </CardDescription>
        {snapshot ? (
          <CardAction>
            <StatusLevelBadge level={snapshot.overall} />
          </CardAction>
        ) : null}
      </CardHeader>
      {snapshot ? (
        <CardContent>
          <dl className="grid grid-cols-3 gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-xs text-muted-foreground">Incidentes em aberto</dt>
              <dd className="text-2xl font-semibold tabular-nums">{formatNumber(openIncidents)}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-xs text-muted-foreground">Manutenções em andamento</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatNumber(runningMaintenances)}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-xs text-muted-foreground">Manutenções agendadas</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatNumber(snapshot.upcomingMaintenances.length)}
              </dd>
            </div>
          </dl>
        </CardContent>
      ) : null}
      <CardFooter>
        <Button
          variant="outline"
          render={<Link href={PLATFORM_STATUS_PATH} />}
          nativeButton={false}
        >
          <RadarIcon data-icon="inline-start" />
          Abrir status público
        </Button>
      </CardFooter>
    </Card>
  )
}
