import { CheckIcon } from "lucide-react"

import {
  BILLING_INTERVAL_LABELS,
  formatBRL,
  maxExtraSeats,
  PLANS,
  type BillingInterval,
  type PlanKey,
} from "@workspace/core/billing"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"

import {
  keyBenefits,
  pluralize,
  totalWithSeats,
  type PlanPricing,
} from "@/components/billing/plan-content"

type PlanCardProps = {
  plan: PlanKey
  interval: BillingInterval
  pricing: PlanPricing
  /** Usuários extras já escolhidos (somados ao total exibido). */
  extraSeats?: number
  /** Versão reduzida para a tela de assinatura (3 benefícios, sem descrição). */
  compact?: boolean
  current?: boolean
  headingLevel?: "h2" | "h3"
  footer?: React.ReactNode
}

/** Cartão de plano. Sem estado: serve a páginas do servidor e a componentes de cliente. */
export function PlanCard({
  plan,
  interval,
  pricing,
  extraSeats = 0,
  compact = false,
  current = false,
  headingLevel: Heading = "h3",
  footer,
}: PlanCardProps) {
  const details = PLANS[plan]
  // Os 8 itens comuns a todos os planos, com o limite de imóveis com foto primeiro.
  const benefits = keyBenefits(plan, compact ? 3 : 8)
  const suffix = BILLING_INTERVAL_LABELS[interval].suffix
  const monthlyEquivalent = interval === "year" ? Math.round(pricing.price / 12) : pricing.price
  const maxExtra = maxExtraSeats(plan)
  const headingId = `plano-${plan}${compact ? "-compacto" : ""}`

  return (
    <Card size={compact ? "sm" : "default"} role="group" aria-labelledby={headingId}>
      <CardHeader>
        <CardTitle>
          <Heading id={headingId}>{details.name}</Heading>
        </CardTitle>
        <CardDescription>{details.audience}</CardDescription>
        {current || details.highlight ? (
          <CardAction>
            {current ? <Badge variant="outline">Plano atual</Badge> : <Badge>Mais escolhido</Badge>}
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="flex items-baseline gap-1">
            <span
              className={
                compact
                  ? "text-2xl font-semibold tracking-tight tabular-nums"
                  : "text-3xl font-semibold tracking-tight tabular-nums"
              }
            >
              {formatBRL(monthlyEquivalent, { omitZeroCents: true })}
            </span>
            <span className="text-muted-foreground">/mês</span>
          </p>
          <p className="text-muted-foreground">
            {interval === "year"
              ? `${formatBRL(pricing.price, { omitZeroCents: true })} cobrados por ano`
              : "Cobrança mensal, sem fidelidade"}
          </p>
        </div>

        <p className="text-muted-foreground">
          {pluralize(details.usersIncluded, "usuário incluído", "usuários incluídos")}
          {maxExtra > 0
            ? ` · extra ${formatBRL(pricing.seatPrice, { omitZeroCents: true })}${suffix}`
            : ""}
          {Number.isFinite(maxExtra) && maxExtra > 0
            ? ` (até ${pluralize(details.usersMax, "pessoa", "pessoas")})`
            : ""}
        </p>

        {extraSeats > 0 ? (
          <p className="font-medium">
            Com {pluralize(extraSeats, "usuário extra", "usuários extras")}:{" "}
            <span className="tabular-nums">
              {formatBRL(totalWithSeats(pricing, extraSeats), { omitZeroCents: true })}
              {suffix}
            </span>
          </p>
        ) : null}

        {compact ? null : <p>{details.description}</p>}

        <Separator />

        <ul className="flex flex-col gap-2" aria-label={`Benefícios do plano ${details.name}`}>
          {benefits.map((benefit) => (
            <li key={benefit.text} className="flex items-start gap-2">
              <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {benefit.text}
                {benefit.status === "soon" ? <Badge variant="outline">Em breve</Badge> : null}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      {footer ? <CardFooter className="flex-col items-stretch gap-2">{footer}</CardFooter> : null}
    </Card>
  )
}
