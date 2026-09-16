import { TriangleAlertIcon } from "lucide-react"

import {
  formatLimit,
  isAtLimit,
  isNearLimit,
  PLAN_KEYS,
  PLANS,
  usageRatio,
  type BillingPlanKey,
  type PlanKey,
} from "@workspace/core/billing"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"

import { pluralize } from "@/components/billing/plan-content"
import type { BillingOverview } from "@/lib/billing/queries"
import { formatNumber } from "@/lib/format"

type MeterKey = "users" | "landing_pages"

type Meter = { key: MeterKey; label: string; used: number; limit: number }

/** Próximo plano cujo limite comporta o uso atual (mais um item). */
function nextPlanFor(planKey: BillingPlanKey, key: MeterKey, used: number): PlanKey | null {
  const start = planKey === "trial" ? 0 : PLAN_KEYS.indexOf(planKey) + 1

  return (
    PLAN_KEYS.slice(start).find((plan) => {
      const limit = PLANS[plan].limits[key]
      return limit < 0 || limit > used
    }) ?? null
  )
}

function warningText(meter: Meter, planKey: BillingPlanKey) {
  const suggestion = nextPlanFor(planKey, meter.key, meter.used)
  const usage = `${meter.label}: ${formatNumber(meter.used)} de ${formatLimit(meter.limit)}.`

  if (meter.key === "users") {
    return suggestion
      ? `${usage} Contrate usuários extras ou mude para o plano ${PLANS[suggestion].name}, com ${pluralize(PLANS[suggestion].usersIncluded, "usuário incluído", "usuários incluídos")}.`
      : `${usage} Contrate usuários extras para crescer a equipe.`
  }

  // Todos os planos têm a mesma franquia de landing page, então não há plano
  // maior a sugerir: o caminho é despublicar a atual e publicar outra.
  if (!suggestion) {
    return `${usage} Despublique a página que está no ar para publicar outra; os modelos continuam todos disponíveis.`
  }

  const limit = PLANS[suggestion].limits.landing_pages
  return `${usage} O plano ${PLANS[suggestion].name} permite ${
    limit < 0 ? "landing pages ilimitadas" : pluralize(limit, "landing page", "landing pages")
  }.`
}

type UsageMetersProps = {
  overview: BillingOverview
  /** Mostra o link para os planos (quem pode assinar ou trocar). */
  upgradeHref?: string
}

/** Medidores de uso contra o limite do plano, com aviso a partir de 80%. */
export function UsageMeters({ overview, upgradeHref }: UsageMetersProps) {
  const meters: Meter[] = [
    {
      key: "users",
      label: "Usuários",
      used: overview.usage.users,
      limit: overview.limits.users ?? overview.seats,
    },
    {
      key: "landing_pages",
      label: "Landing pages publicadas",
      used: overview.usage.landingPages,
      // Chave ausente = ilimitado.
      limit: overview.limits.landing_pages ?? -1,
    },
  ]

  const warnings = meters.filter((meter) => isNearLimit(meter.limit, meter.used))

  return (
    <div className="flex flex-col gap-6">
      {meters.map((meter) => {
        const ratio = usageRatio(meter.limit, meter.used)
        const atLimit = isAtLimit(meter.limit, meter.used)

        return (
          <div key={meter.key} className="flex flex-col gap-2">
            {ratio === null ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">{meter.label}</span>
                <span className="ms-auto text-sm text-muted-foreground tabular-nums">
                  {formatNumber(meter.used)} · Ilimitado
                </span>
              </div>
            ) : (
              <Progress value={Math.min(100, Math.round(ratio * 100))}>
                <ProgressLabel>{meter.label}</ProgressLabel>
                <span className="ms-auto text-sm text-muted-foreground tabular-nums">
                  {formatNumber(meter.used)} de {formatLimit(meter.limit)}
                </span>
              </Progress>
            )}
            {isNearLimit(meter.limit, meter.used) ? (
              <Badge variant={atLimit ? "destructive" : "secondary"}>
                {atLimit ? "Limite atingido" : "Perto do limite"}
              </Badge>
            ) : null}
          </div>
        )
      })}

      <p className="text-sm text-muted-foreground">
        Imóveis, condomínios e clientes são ilimitados em todos os planos
        {` (hoje: ${pluralize(overview.usage.activeProperties, "imóvel ativo", "imóveis ativos")})`}
        .
      </p>

      {warnings.length > 0 ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Perto do limite do plano</AlertTitle>
          <AlertDescription>
            {warnings.map((meter) => (
              <p key={meter.key}>{warningText(meter, overview.planKey)}</p>
            ))}
            {upgradeHref ? (
              <p>
                <a href={upgradeHref}>Ver opções de plano</a>
              </p>
            ) : (
              <p>Para mudar de plano, fale com o dono da imobiliária.</p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
