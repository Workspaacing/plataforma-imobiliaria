// Recomendador de /planos: 3 perguntas → plano, assentos extras e custo.
// Regra simples e explicável, aplicada em ordem:
// 1. tamanho da equipe: 1 → Corretor; 2 a 5 → Imobiliária; 6 a 15 → Equipe; 16+ → Rede;
// 2. quem faz locação nunca fica no Corretor (sobe para Imobiliária);
// 3. mais de 300 leads por mês sobe pelo menos para Equipe;
// 4. se a equipe passa do teto de usuários do plano (usersMax), sobe de plano;
// 5. assentos extras = pessoas além dos usuários incluídos.
// Valores em centavos; a economia anual compara 12 mensalidades com o anual.

import { PLAN_KEYS, PLANS, planTotal, type PlanKey } from "./plans"

export type RecommendPlanInput = {
  teamSize: number
  doesRentals: boolean
  leadsPerMonth: number
}

export type PlanRecommendation = {
  plan: PlanKey
  extraSeats: number
  /** Centavos por mês no plano mensal (plano + extras). */
  monthlyTotal: number
  /** Centavos por ano no plano anual (plano + extras). */
  yearlyTotal: number
  /** Centavos economizados no anual contra 12 mensalidades. */
  yearlySavings: number
  /** Motivos em pt-BR, na ordem em que as regras foram aplicadas. */
  reasons: string[]
}

/** Acima deste volume mensal de leads, o mínimo recomendado é o Equipe. */
export const HIGH_LEAD_VOLUME = 300

function rank(plan: PlanKey): number {
  return PLAN_KEYS.indexOf(plan)
}

function planForTeamSize(teamSize: number): PlanKey {
  if (teamSize <= 1) return "corretor"
  if (teamSize <= 5) return "imobiliaria"
  if (teamSize <= 15) return "equipe"
  return "rede"
}

function fitsUsers(plan: PlanKey, teamSize: number): boolean {
  const { usersMax } = PLANS[plan]
  return usersMax < 0 || teamSize <= usersMax
}

export function recommendPlan(input: RecommendPlanInput): PlanRecommendation {
  const teamSize = Number.isFinite(input.teamSize) ? Math.max(1, Math.ceil(input.teamSize)) : 1
  const leadsPerMonth = Number.isFinite(input.leadsPerMonth) ? input.leadsPerMonth : 0
  const reasons: string[] = []

  let plan = planForTeamSize(teamSize)
  reasons.push(
    teamSize === 1
      ? `Para 1 pessoa, o indicado é o plano ${PLANS[plan].name}.`
      : `Para ${teamSize} pessoas, o indicado é o plano ${PLANS[plan].name}.`
  )

  if (input.doesRentals && rank(plan) < rank("imobiliaria")) {
    plan = "imobiliaria"
    reasons.push(`Quem faz locação precisa pelo menos do plano ${PLANS.imobiliaria.name}.`)
  }

  if (leadsPerMonth > HIGH_LEAD_VOLUME && rank(plan) < rank("equipe")) {
    plan = "equipe"
    reasons.push(
      `Com mais de ${HIGH_LEAD_VOLUME} leads por mês, o indicado é pelo menos o plano ${PLANS.equipe.name}.`
    )
  }

  while (!fitsUsers(plan, teamSize)) {
    const next = PLAN_KEYS[rank(plan) + 1]
    if (!next) break

    reasons.push(
      `O plano ${PLANS[plan].name} vai até ${PLANS[plan].usersMax} usuários; para ${teamSize}, o indicado é o ${PLANS[next].name}.`
    )
    plan = next
  }

  const extraSeats = Math.max(0, teamSize - PLANS[plan].usersIncluded)

  if (extraSeats > 0) {
    reasons.push(
      extraSeats === 1
        ? `Inclui 1 usuário extra além dos ${PLANS[plan].usersIncluded} do plano.`
        : `Inclui ${extraSeats} usuários extras além dos ${PLANS[plan].usersIncluded} do plano.`
    )
  }

  const monthlyTotal = planTotal(plan, "month", extraSeats)
  const yearlyTotal = planTotal(plan, "year", extraSeats)

  return {
    plan,
    extraSeats,
    monthlyTotal,
    yearlyTotal,
    yearlySavings: monthlyTotal * 12 - yearlyTotal,
    reasons,
  }
}
