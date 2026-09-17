import Link from "next/link"
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react"

import {
  AI_COST_CYCLE_LABELS,
  AI_COST_CYCLES,
  formatAiMillicents,
  formatAiRatio,
  type AiConversationCalibration,
  type AiCostCycle,
  type AiCostRow,
  type AiCostSummary,
  type AiPricingCheck,
  type PlatformAiCostsSnapshot,
} from "@workspace/core/platform/ai-costs"
import { formatBRL } from "@workspace/core/billing/format"
import { isBillingPlanKey, PLANS } from "@workspace/core/billing/plans"
import { BILLING_STATE_LABELS, type BillingState } from "@workspace/core/billing/state"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"

import { formatDate, formatNumber } from "@/lib/format"
import { PLATFORM_AI_COSTS_PATH } from "@/lib/plataforma/custos-ia"

function planLabel(planKey: string): string {
  if (planKey === "trial") {
    return "Teste grátis"
  }

  return isBillingPlanKey(planKey) && planKey !== "trial" ? PLANS[planKey].name : planKey
}

function stateLabel(state: string): string {
  return state in BILLING_STATE_LABELS ? BILLING_STATE_LABELS[state as BillingState] : state
}

function progressValue(ratio: number | null): number | null {
  return ratio === null ? null : Math.min(100, Math.max(0, Math.round(ratio * 100)))
}

function CycleSwitch({ cycle }: { cycle: AiCostCycle }) {
  return (
    <nav aria-label="Ciclo" className="flex flex-wrap gap-2">
      {AI_COST_CYCLES.map((option) => (
        <Button
          key={option}
          variant={option === cycle ? "secondary" : "ghost"}
          aria-current={option === cycle ? "page" : undefined}
          render={
            <Link
              href={
                option === "atual"
                  ? PLATFORM_AI_COSTS_PATH
                  : `${PLATFORM_AI_COSTS_PATH}?ciclo=${option}`
              }
              scroll={false}
            />
          }
          nativeButton={false}
        >
          {AI_COST_CYCLE_LABELS[option]}
        </Button>
      ))}
    </nav>
  )
}

function SummaryCards({
  summary,
  snapshot,
}: {
  summary: AiCostSummary
  snapshot: PlatformAiCostsSnapshot
}) {
  const items = [
    {
      label: "Custo de IA no ciclo",
      value: formatAiMillicents(summary.totals.costMillicents),
      detail: `${formatNumber(summary.rows.length)} de ${formatNumber(snapshot.organizationsWithAi)} imobiliárias com IA no plano tiveram consumo.`,
    },
    {
      label: "Teto somado",
      value: formatBRL(summary.totalCapCents),
      detail: `${formatAiRatio(summary.totalCapRatio)} usado, só entre quem teve consumo.`,
    },
    {
      label: "Acima de 80% do teto",
      value: formatNumber(summary.overWarning.length),
      detail:
        summary.overWarning.length === 0
          ? "Nenhuma imobiliária perto do corte."
          : "Perto do corte: a IA para no teto.",
    },
    {
      label: "Conversas e requisições",
      value: `${formatNumber(summary.totals.conversations)} · ${formatNumber(summary.totals.requests)}`,
      detail: "Conversas da franquia · chamadas ao modelo.",
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardContent>
            <dl className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{item.value}</dd>
              <dd className="text-xs text-muted-foreground">{item.detail}</dd>
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function OrganizationRow({ row }: { row: AiCostRow }) {
  const value = progressValue(row.capRatio)

  return (
    <li className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.organizationName}</span>
          <span className="text-xs text-muted-foreground">
            {planLabel(row.planKey)} · {stateLabel(row.billingState)} · ciclo de{" "}
            {formatDate(row.periodStart)} a {formatDate(row.periodEnd)}
          </span>
        </div>
        {row.overWarning ? (
          <Badge variant="destructive">
            <TriangleAlertIcon data-icon="inline-start" />
            {formatAiRatio(row.capRatio)} do teto
          </Badge>
        ) : (
          <Badge variant="outline">
            {row.capRatio === null ? "Sem teto" : `${formatAiRatio(row.capRatio)} do teto`}
          </Badge>
        )}
      </div>
      {value !== null ? (
        <Progress value={value}>
          <ProgressLabel className="sr-only">
            Teto de IA usado por {row.organizationName}
          </ProgressLabel>
        </Progress>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div className="flex min-w-0 flex-col">
          <dt className="text-xs text-muted-foreground">Custo real</dt>
          <dd className="tabular-nums">
            {formatAiMillicents(row.usage.costMillicents)} de {formatBRL(row.capCents)}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-xs text-muted-foreground">Conversas</dt>
          <dd className="tabular-nums">{formatNumber(row.usage.conversations)}</dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-xs text-muted-foreground">Requisições</dt>
          <dd className="tabular-nums">{formatNumber(row.usage.requests)}</dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-xs text-muted-foreground">Custo por conversa</dt>
          <dd className="tabular-nums">
            {row.costPerConversationMillicents === null
              ? "—"
              : formatAiMillicents(row.costPerConversationMillicents)}
          </dd>
        </div>
      </dl>
      <p className="text-xs break-words text-muted-foreground tabular-nums">
        Tokens: entrada {formatNumber(row.usage.inputTokens)} · saída{" "}
        {formatNumber(row.usage.outputTokens)} · cache lido{" "}
        {formatNumber(row.usage.cacheReadTokens)} · cache gravado{" "}
        {formatNumber(row.usage.cacheWriteTokens)}
      </p>
    </li>
  )
}

const TOKEN_LABELS = [
  ["inputTokens", "Entrada"],
  ["outputTokens", "Saída (com raciocínio)"],
  ["cacheReadTokens", "Leitura de cache"],
  ["cacheWriteTokens", "Escrita de cache"],
] as const

function CalibrationCard({ calibration }: { calibration: AiConversationCalibration }) {
  const needsReview = calibration.status === "acima"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversa real x estimativa</CardTitle>
        <CardDescription>
          Custo médio medido por conversa contra a conversa típica usada nos planos
          (AI_TYPICAL_CONVERSATION), ao câmbio do banco. Inclui os pedidos avulsos, que contam 1
          conversa cada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Medido</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {calibration.measuredMillicents === null
                ? "—"
                : formatAiMillicents(calibration.measuredMillicents)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Estimado</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatAiMillicents(calibration.estimatedMillicents)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Diferença</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {calibration.deviation === null
                ? "—"
                : `${calibration.deviation > 0 ? "+" : ""}${formatAiRatio(calibration.deviation)}`}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Amostra</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatNumber(calibration.conversations)}
            </dd>
          </div>
        </dl>

        <Alert variant={needsReview ? "destructive" : "default"}>
          {needsReview ? <TriangleAlertIcon /> : <CircleCheckIcon />}
          <AlertTitle>
            {calibration.status === "acima"
              ? "Revise a estimativa"
              : calibration.status === "abaixo"
                ? "Dá para recalibrar para baixo"
                : calibration.status === "dentro"
                  ? "Estimativa em dia"
                  : "Ainda sem base para recalibrar"}
          </AlertTitle>
          <AlertDescription>{calibration.message}</AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Tokens por conversa</h3>
          <dl className="flex flex-col divide-y text-sm">
            {TOKEN_LABELS.map(([key, label]) => (
              <div key={key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular-nums">
                  {calibration.measuredTokens ? formatNumber(calibration.measuredTokens[key]) : "—"}{" "}
                  <span className="text-muted-foreground">
                    medido · {formatNumber(calibration.estimatedTokens[key])} estimado
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  )
}

function MatchBadge({ matches }: { matches: boolean }) {
  return matches ? (
    <Badge variant="secondary">
      <CircleCheckIcon data-icon="inline-start" />
      Confere
    </Badge>
  ) : (
    <Badge variant="destructive">
      <TriangleAlertIcon data-icon="inline-start" />
      Diferente
    </Badge>
  )
}

function PricingCard({
  pricing,
  snapshot,
}: {
  pricing: AiPricingCheck
  snapshot: PlatformAiCostsSnapshot
}) {
  const prices = snapshot.pricing
  const rate = (value: number | null) =>
    value === null
      ? "—"
      : `R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4 }).format(value)}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preço e câmbio em uso</CardTitle>
        <CardDescription>
          O banco (private.ai_pricing e private.ai_cost_cap_cents) é quem mede e corta; o core
          (packages/core/src/billing/ai-usage.ts) projeta os planos. Os dois precisam bater.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="flex flex-col divide-y">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <dt className="text-muted-foreground">Câmbio da medição (US$ → R$)</dt>
            <dd className="flex flex-wrap items-center gap-2 tabular-nums">
              {rate(pricing.databaseExchangeRate)}
              <span className="text-muted-foreground">core {rate(pricing.coreExchangeRate)}</span>
              <MatchBadge matches={pricing.exchangeRateMatches} />
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <dt className="text-muted-foreground">Modelo e preço por milhão de tokens</dt>
            <dd className="flex flex-wrap items-center gap-2 tabular-nums">
              {prices
                ? `${prices.model}: entrada US$ ${formatNumber(prices.usdPerMtokInput)} · saída US$ ${formatNumber(prices.usdPerMtokOutput)} · cache lido US$ ${formatNumber(prices.usdPerMtokCacheRead)} · cache gravado US$ ${formatNumber(prices.usdPerMtokCacheWrite)}`
                : "Indisponível"}
              <MatchBadge matches={pricing.pricesMatch} />
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Teto de IA por plano (por ciclo)</h3>
          <ul className="flex flex-col divide-y">
            {pricing.planCaps.map((cap) => (
              <li
                key={cap.planKey}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>{planLabel(cap.planKey)}</span>
                <span className="flex flex-wrap items-center gap-2 tabular-nums">
                  {cap.databaseCents === 0 ? "Sem IA" : formatBRL(cap.databaseCents)}
                  {cap.matches ? null : (
                    <span className="text-muted-foreground">
                      core {cap.coreCents === null ? "—" : formatBRL(cap.coreCents)}
                    </span>
                  )}
                  <MatchBadge matches={cap.matches} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

/** Tela de custos de IA de um ciclo (só números). */
export function AiCostsOverview({
  snapshot,
  summary,
}: {
  snapshot: PlatformAiCostsSnapshot
  summary: AiCostSummary
}) {
  return (
    <>
      <CycleSwitch cycle={summary.cycle} />

      <SummaryCards summary={summary} snapshot={snapshot} />

      {summary.overWarning.length > 0 ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>
            {summary.overWarning.length === 1
              ? "1 imobiliária passou de 80% do teto"
              : `${formatNumber(summary.overWarning.length)} imobiliárias passaram de 80% do teto`}
          </AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {summary.overWarning.map((row) => (
                <li key={row.organizationId}>
                  {row.organizationName}: {formatAiRatio(row.capRatio)} (
                  {formatAiMillicents(row.usage.costMillicents)} de {formatBRL(row.capCents)})
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Por imobiliária</CardTitle>
          <CardDescription>
            {summary.cycle === "atual"
              ? "Cada imobiliária tem o próprio ciclo, que vira no dia da assinatura."
              : "Último ciclo fechado de cada imobiliária. O teto mostrado é o do plano atual."}{" "}
            Custo exatamente como está em ai_usage_periods (inclui reservas ainda não acertadas).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum consumo de IA neste ciclo.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {summary.rows.map((row) => (
                <OrganizationRow key={row.organizationId} row={row} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <CalibrationCard calibration={summary.calibration} />
        <PricingCard pricing={summary.pricing} snapshot={snapshot} />
      </div>
    </>
  )
}
