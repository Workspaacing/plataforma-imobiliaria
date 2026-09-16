import {
  ChartNoAxesColumnIcon,
  FunnelIcon,
  SproutIcon,
  TriangleAlertIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { formatHours, formatMinutes, formatRate } from "@workspace/core/reports/rates"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Progress } from "@workspace/ui/components/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { FunnelChartView, type FunnelPoint } from "@/components/relatorios/funnel-chart"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { formatCurrency } from "@/lib/format"
import type {
  BrokerReport,
  FunnelReport,
  FunnelStageRow,
  LostReasonReport,
  SourceReport,
} from "@/lib/relatorios/queries"

const integerFormat = new Intl.NumberFormat("pt-BR")

function count(value: number) {
  return integerFormat.format(value)
}

function ReportEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <Empty className="min-h-56 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function LoadError({ what }: { what: string }) {
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>Não foi possível carregar {what}</AlertTitle>
      <AlertDescription>
        Recarregue a página em instantes. Se continuar assim, confira se as migrações do banco foram
        aplicadas.
      </AlertDescription>
    </Alert>
  )
}

// -----------------------------------------------------------------------------
// Por corretor
// -----------------------------------------------------------------------------

export function BrokersSection({
  report,
  periodLabel,
  canSeeTeam,
}: {
  report: BrokerReport
  periodLabel: string
  canSeeTeam: boolean
}) {
  if (report.failed) {
    return <LoadError what="o desempenho por corretor" />
  }

  if (report.rows.length === 0) {
    return (
      <ReportEmpty
        icon={UsersIcon}
        title="Nenhum corretor com movimento no período"
        description="Assim que entrarem leads, captações ou propostas no período escolhido, cada corretor vira uma linha aqui."
      />
    )
  }

  const { totals } = report

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desempenho por corretor</CardTitle>
        <CardDescription>
          {periodLabel}. &quot;Recebidos&quot; são os leads entregues ao corretor no período;
          &quot;ganhos&quot; e &quot;perdidos&quot;, os que ele fechou ou perdeu no período, pelo
          histórico de etapa. &quot;Em aberto&quot; é a foto de hoje.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Corretor</TableHead>
                <TableHead className="text-end">Recebidos</TableHead>
                <TableHead className="text-end">Atendidos</TableHead>
                <TableHead className="text-end">No prazo</TableHead>
                <TableHead className="text-end">1º contato</TableHead>
                <TableHead className="text-end">Ganhos</TableHead>
                <TableHead className="text-end">Perdidos</TableHead>
                <TableHead className="text-end">Fechamento</TableHead>
                <TableHead className="text-end">Em aberto</TableHead>
                <TableHead className="text-end">Captações</TableHead>
                <TableHead className="text-end">Propostas</TableHead>
                <TableHead className="text-end">Valor fechado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.role ? ROLE_LABELS[row.role] : "Sem papel"}
                        {row.active ? "" : " · inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(row.leadsReceived)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(row.leadsAnswered)}
                    <span className="text-muted-foreground">
                      {" "}
                      ({formatRate(row.rates.answerRate)})
                    </span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(row.leadsInSla)}
                    <span className="text-muted-foreground">
                      {" "}
                      ({formatRate(row.rates.slaRate)})
                    </span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatMinutes(row.firstResponseMedianMinutes)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{count(row.leadsWon)}</TableCell>
                  <TableCell className="text-end tabular-nums">{count(row.leadsLost)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatRate(row.rates.winRate)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{count(row.leadsOpen)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(row.propertiesCaptured)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(row.proposalsClosed)}/{count(row.proposalsMade)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(row.proposalsClosedAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {canSeeTeam && report.rows.length > 1 ? (
              <TableFooter>
                <TableRow>
                  <TableCell>Equipe</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(totals.leadsReceived)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(totals.leadsAnswered)}
                    <span className="text-muted-foreground">
                      {" "}
                      ({formatRate(totals.rates.answerRate)})
                    </span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(totals.leadsInSla)}
                    <span className="text-muted-foreground">
                      {" "}
                      ({formatRate(totals.rates.slaRate)})
                    </span>
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground">—</TableCell>
                  <TableCell className="text-end tabular-nums">{count(totals.leadsWon)}</TableCell>
                  <TableCell className="text-end tabular-nums">{count(totals.leadsLost)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatRate(totals.rates.winRate)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{count(totals.leadsOpen)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(totals.propertiesCaptured)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {count(totals.proposalsClosed)}/{count(totals.proposalsMade)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(totals.proposalsClosedAmount)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      </CardContent>
      {canSeeTeam && report.rows.some((row) => row.leadsTakenBySla > 0) ? (
        <CardFooter className="flex-wrap gap-2 text-muted-foreground">
          Leads devolvidos à roleta por estouro do prazo:{" "}
          {report.rows
            .filter((row) => row.leadsTakenBySla > 0)
            .map((row) => `${row.name} (${count(row.leadsTakenBySla)})`)
            .join(" · ")}
          .
        </CardFooter>
      ) : null}
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Funil por etapa
// -----------------------------------------------------------------------------

/** Rótulos do gráfico montados no servidor, para o HTML dos dois lados bater. */
function funnelPoints(stages: readonly FunnelStageRow[]): FunnelPoint[] {
  return stages.map((stage) => ({
    label: stage.label,
    entered: stage.entered,
    advanced: stage.advanced,
    advanceLabel: stage.entered > 0 ? formatRate(stage.rates.advanceRate) : "",
    medianLabel: formatHours(stage.medianHours),
  }))
}

export function FunnelSection({
  report,
  periodLabel,
}: {
  report: FunnelReport
  periodLabel: string
}) {
  if (report.failed) {
    return <LoadError what="o funil por etapa" />
  }

  if (report.totalEntered === 0) {
    return (
      <ReportEmpty
        icon={FunnelIcon}
        title="Nenhuma mudança de etapa no período"
        description="O funil é montado a partir do histórico de etapa dos leads. Assim que a equipe mover leads no quadro, a conversão e o tempo em cada fase aparecem aqui."
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil por etapa</CardTitle>
        <CardDescription>
          {periodLabel}. Sai do histórico de etapa de cada lead: quantos entraram em cada fase,
          quantos avançaram para a etapa seguinte (a taxa ao lado da barra), quantos se perderam
          depois e quanto tempo o lead ficou parado ali.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FunnelChartView data={funnelPoints(report.stages)} />

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-end">Entraram</TableHead>
                <TableHead className="text-end">Avançaram</TableHead>
                <TableHead className="text-end">Conversão</TableHead>
                <TableHead className="text-end">Perderam</TableHead>
                <TableHead className="text-end">Ainda aqui</TableHead>
                <TableHead className="text-end">Tempo na etapa (mediana)</TableHead>
                <TableHead className="text-end">Tempo na etapa (média)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.stages.map((stage) => (
                <TableRow key={stage.stage}>
                  <TableCell className="font-medium">{stage.label}</TableCell>
                  <TableCell className="text-end tabular-nums">{count(stage.entered)}</TableCell>
                  <TableCell className="text-end tabular-nums">{count(stage.advanced)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatRate(stage.rates.advanceRate)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{count(stage.lostAfter)}</TableCell>
                  <TableCell className="text-end tabular-nums">{count(stage.stillThere)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatHours(stage.medianHours)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatHours(stage.avgHours)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground">
        Um lead que volta de etapa conta uma nova entrada, de propósito: retrabalho é informação. Ir
        para &quot;Perdido&quot; nunca conta como avanço.
      </CardFooter>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Origem do lead
// -----------------------------------------------------------------------------

export function SourcesSection({
  report,
  periodLabel,
}: {
  report: SourceReport
  periodLabel: string
}) {
  if (report.failed) {
    return <LoadError what="a origem dos leads" />
  }

  if (report.rows.length === 0) {
    return (
      <ReportEmpty
        icon={SproutIcon}
        title="Nenhum lead no período"
        description="Publique a landing page ou cadastre um lead do telefone para descobrir qual origem traz gente que fecha, e não só gente que chega."
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origem do lead</CardTitle>
        <CardDescription>
          {periodLabel}. Leads criados no período, agrupados por canal, landing page e campanha
          (utm). A coluna de conversão é o que separa a origem que traz volume da origem que traz
          negócio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Landing page</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-end">Leads</TableHead>
                <TableHead className="text-end">Atendidos</TableHead>
                <TableHead className="text-end">Ganhos</TableHead>
                <TableHead className="text-end">Perdidos</TableHead>
                <TableHead className="text-end">Conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.sourceLabel}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.landingPageName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.utmCampaign || row.utmSource || row.utmMedium ? (
                      <div className="flex flex-wrap gap-1">
                        {row.utmCampaign ? (
                          <Badge variant="secondary">{row.utmCampaign}</Badge>
                        ) : null}
                        {row.utmSource ? <Badge variant="outline">{row.utmSource}</Badge> : null}
                        {row.utmMedium ? <Badge variant="outline">{row.utmMedium}</Badge> : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{count(row.leads)}</TableCell>
                  <TableCell className="text-end tabular-nums">{count(row.answered)}</TableCell>
                  <TableCell className="text-end tabular-nums">{count(row.won)}</TableCell>
                  <TableCell className="text-end tabular-nums">{count(row.lost)}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatRate(row.winRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total do período</TableCell>
                <TableCell className="text-end tabular-nums">{count(report.totalLeads)}</TableCell>
                <TableCell className="text-end text-muted-foreground">—</TableCell>
                <TableCell className="text-end tabular-nums">{count(report.totalWon)}</TableCell>
                <TableCell className="text-end text-muted-foreground">—</TableCell>
                <TableCell className="text-end text-muted-foreground">—</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Motivo da perda
// -----------------------------------------------------------------------------

export function LostReasonsSection({
  report,
  periodLabel,
}: {
  report: LostReasonReport
  periodLabel: string
}) {
  if (report.failed) {
    return <LoadError what="os motivos de perda" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Por que os leads foram perdidos</CardTitle>
        <CardDescription>
          {periodLabel}. Leads que entraram em &quot;Perdido&quot;, agrupados pelo motivo anotado no
          registro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {report.rows.length === 0 ? (
          <ReportEmpty
            icon={ChartNoAxesColumnIcon}
            title="Nenhum lead perdido no período"
            description="Quando um lead for para a coluna Perdido, o motivo anotado aparece aqui."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {report.rows.map((row) => (
              <li key={row.label} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  <span className="tabular-nums">
                    {count(row.total)}
                    <span className="text-muted-foreground"> ({formatRate(row.share)})</span>
                  </span>
                </div>
                <Progress value={(row.share ?? 0) * 100} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {report.total > 0 ? (
        <CardFooter className="text-muted-foreground">
          {count(report.total)} lead(s) perdido(s) no período.
        </CardFooter>
      ) : null}
    </Card>
  )
}
