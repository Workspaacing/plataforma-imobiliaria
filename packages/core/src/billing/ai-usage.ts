// Medição e corte de IA: preços do modelo, tetos de custo por plano, peso por
// tipo de uso e a decisão de liberar ou bloquear uma requisição.
//
// Regra do dono (não negociável): o produto não pode ter prejuízo com IA em
// nenhum plano, em nenhuma hipótese. Por isso a trava principal é um TETO DE
// CUSTO EM REAIS por ciclo, acima de qualquer contagem de conversa: a franquia
// de conversas é o rótulo comercial (o que o cliente compra), o teto em reais é
// o que garante a margem. Quando o teto estoura, bloqueia — mesmo que ainda
// sobrem conversas na franquia.
//
// Estas funções são puras: o app usa para projetar e explicar, mas quem aplica o
// corte de verdade é o banco (RPC reserve_ai_usage, migração ai_usage_metering),
// que repete a mesma regra. Ao mudar qualquer constante aqui, mude também
// private.ai_pricing() e private.ai_cost_cap_cents() no SQL.

import type { BillingState } from "./state"
import { PLANS, type BillingPlanKey, type PlanKey } from "./plans"

// ---------------------------------------------------------------------------
// 1. Modelo e preços (US$ por milhão de tokens)
// ---------------------------------------------------------------------------

/** Modelo fixo do produto. Trocar de modelo muda o custo: revise os tetos junto. */
export const AI_MODEL = "claude-sonnet-5"
export const AI_MODEL_LABEL = "Claude Sonnet 5"
export const AI_MODEL_CONTEXT_TOKENS = 1_000_000

/** Data da tabela de preços consultada. Preço muda: confira antes de reajustar planos. */
export const AI_PRICING_CHECKED_AT = "2026-09-16"

/**
 * Preço oficial em US$ por milhão de tokens (Sonnet 5, 2026-09-16):
 * entrada 2,00; saída 10,00; leitura de cache ~10% da entrada; escrita de cache 1,25x a entrada.
 */
export const AI_PRICE_USD_PER_MTOK = {
  input: 2,
  output: 10,
  cacheRead: 0.2,
  cacheWrite: 2.5,
} as const

/**
 * Câmbio configurável. `ptax` é a cotação oficial do dia consultado; `card` é o
 * dólar efetivo de cartão (com IOF e spread), que é o que a empresa paga de fato.
 * O padrão é o `card`: superestimar o câmbio protege a margem.
 */
export const AI_EXCHANGE_RATES = { ptax: 5.149, card: 5.6 } as const
export const AI_EXCHANGE_RATE_DEFAULT: number = AI_EXCHANGE_RATES.card

// ---------------------------------------------------------------------------
// 2. Tetos de custo por plano
// ---------------------------------------------------------------------------

/**
 * Fatia do preço de tabela do plano que pode virar custo de IA num ciclo.
 * Comece em 15% e ajuste aqui (um número só) se a margem mudar.
 */
export const AI_COST_CAP_PCT = 0.15

/** Teto do teste grátis em centavos (o trial não paga nada: valor fixo e pequeno). */
export const AI_TRIAL_COST_CAP_CENTS = 300

/** O teto do ciclo também vale por dia (1/N) e por semana (1/M): ninguém queima o mês num dia. */
export const AI_DAILY_CAP_DIVISOR = 15
export const AI_WEEKLY_CAP_DIVISOR = 4

/**
 * Piso das janelas curtas, em centavos. Sem ele, num teto de ciclo pequeno (o
 * teste grátis) a fração diária não pagaria nem uma conversa e o corte do dia
 * viraria o corte real. O piso só afrouxa o ritmo: nunca passa do teto do
 * ciclo, que continua sendo o limite de gasto.
 */
export const AI_MIN_DAILY_CAP_CENTS = 50
export const AI_MIN_WEEKLY_CAP_CENTS = 150

/**
 * Teto de custo de IA do ciclo, em centavos.
 *
 * Usa sempre o PREÇO DE TABELA MENSAL do plano, nunca o valor efetivamente
 * cobrado. Dois motivos:
 *  - Indique e ganhe: quem acumula 100% de desconto paga R$ 0, mas as
 *    indicações dele pagam; calcular sobre o valor com desconto deixaria esse
 *    cliente sem IA nenhuma.
 *  - No plano anual a franquia continua mensal (o ciclo de IA é mensal,
 *    ancorado no dia da assinatura), então o teto também é mensal.
 */
export function aiCostCapCents(plan: BillingPlanKey): number {
  return plan === "trial"
    ? AI_TRIAL_COST_CAP_CENTS
    : Math.round(PLANS[plan].prices.month * AI_COST_CAP_PCT)
}

/** Teto do dia, em centavos: 1/15 do teto do ciclo (para cima), com piso e nunca acima do ciclo. */
export function aiDailyCapCents(cycleCapCents: number): number {
  const cycle = Math.max(0, Math.ceil(cycleCapCents))
  return Math.min(cycle, Math.max(Math.ceil(cycle / AI_DAILY_CAP_DIVISOR), AI_MIN_DAILY_CAP_CENTS))
}

/** Teto da semana, em centavos: 1/4 do teto do ciclo (para cima), com piso e nunca acima do ciclo. */
export function aiWeeklyCapCents(cycleCapCents: number): number {
  const cycle = Math.max(0, Math.ceil(cycleCapCents))
  return Math.min(
    cycle,
    Math.max(Math.ceil(cycle / AI_WEEKLY_CAP_DIVISOR), AI_MIN_WEEKLY_CAP_CENTS)
  )
}

// ---------------------------------------------------------------------------
// 3. Limites por requisição e rajada
// ---------------------------------------------------------------------------

/**
 * Teto de tokens por chamada. Acima disso a requisição é recusada ANTES de
 * acionar o modelo: conversa longa tem que ser resumida ou cortada pela feature,
 * nunca crescer sem teto (o modelo aceita 1M de contexto, o bolso não).
 */
export const AI_MAX_INPUT_TOKENS = 12_000
export const AI_MAX_OUTPUT_TOKENS = 1_500

/** Rajada: impede laço automatizado queimando o teto do dia em segundos. */
export const AI_RATE_LIMIT = { perOrganizationPerMinute: 10, perUserPerMinute: 4 } as const

/** Requisição idêntica (mesmo hash de entrada) dentro da janela devolve a resposta anterior. */
export const AI_DEDUPE_WINDOW_MINUTES = 10

/**
 * Maior teto de excedente que a imobiliária pode definir por ciclo, em centavos
 * (R$ 5.000,00). Trava contra erro de digitação; o mesmo número está no CHECK de
 * billing_accounts.ai_overage_cap_cents.
 */
export const AI_MAX_OVERAGE_CAP_CENTS = 500_000

/** "Conversa" = janela com o mesmo contato. Padrão do WhatsApp (sessão de 24 h). */
export const AI_CONVERSATION_WINDOW_HOURS = 24

// ---------------------------------------------------------------------------
// 4. Tipos de uso e peso
// ---------------------------------------------------------------------------

export const AI_USAGE_KINDS = [
  "conversation",
  "listing_copy",
  "conversation_summary",
  "reply_suggestion",
] as const

export type AiUsageKind = (typeof AI_USAGE_KINDS)[number]

export const AI_USAGE_KIND_LABELS: Record<AiUsageKind, string> = {
  conversation: "Conversa no WhatsApp",
  listing_copy: "Anúncio redigido pela IA",
  conversation_summary: "Resumo de conversa",
  reply_suggestion: "Sugestão de resposta",
}

/**
 * Quanto cada tipo consome da franquia, em unidades inteiras de "conversa".
 *
 * Regra de consumo:
 *  - `conversation`: uma janela de 24 h com o mesmo contato conta UMA vez, por
 *    mais mensagens que tenha (o cliente entende "conversa", não "requisição");
 *  - os demais são requisições avulsas e valem 1 unidade cada.
 *
 * O peso existe para o dono encarecer um tipo que saia caro (ex.: 2) sem mexer
 * na tabela de planos. O custo real de cada tipo não entra aqui: ele entra pelo
 * teto em reais, que é a trava de margem.
 */
export const AI_UNIT_WEIGHTS: Record<AiUsageKind, number> = {
  conversation: 1,
  listing_copy: 1,
  conversation_summary: 1,
  reply_suggestion: 1,
}

export function isAiUsageKind(value: unknown): value is AiUsageKind {
  return typeof value === "string" && (AI_USAGE_KINDS as readonly string[]).includes(value)
}

/** Unidades da franquia consumidas por `units` requisições do tipo. */
export function aiUnitsFor(kind: AiUsageKind, units = 1): number {
  const safe = Number.isFinite(units) ? Math.max(0, Math.floor(units)) : 0
  return safe * AI_UNIT_WEIGHTS[kind]
}

// ---------------------------------------------------------------------------
// 5. Custo
// ---------------------------------------------------------------------------

export type AiTokenUsage = {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/**
 * Custo é guardado em MILÉSIMOS DE CENTAVO (millicents). Uma requisição avulsa
 * custa fração de centavo; arredondar cada uma para o centavo inflaria a conta
 * do cliente em até ~20%. A UI e as RPCs expõem centavos.
 */
export const AI_MILLICENTS_PER_CENT = 1000

function tokens(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value as number) : 0
}

/** Custo em dólares dos tokens informados (entrada, saída, escrita e leitura de cache). */
export function aiCostUsd(usage: AiTokenUsage): number {
  return (
    (tokens(usage.inputTokens) * AI_PRICE_USD_PER_MTOK.input +
      tokens(usage.outputTokens) * AI_PRICE_USD_PER_MTOK.output +
      tokens(usage.cacheReadTokens) * AI_PRICE_USD_PER_MTOK.cacheRead +
      tokens(usage.cacheWriteTokens) * AI_PRICE_USD_PER_MTOK.cacheWrite) /
    1_000_000
  )
}

/** Custo em millicents, arredondado para cima (nunca contar menos do que custou). */
export function aiCostMillicents(usage: AiTokenUsage, rate = AI_EXCHANGE_RATE_DEFAULT): number {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : AI_EXCHANGE_RATE_DEFAULT
  return Math.ceil(aiCostUsd(usage) * safeRate * 100 * AI_MILLICENTS_PER_CENT)
}

/** Millicents → centavos, para exibir. */
export function millicentsToCents(millicents: number): number {
  return Number.isFinite(millicents) ? Math.round(millicents / AI_MILLICENTS_PER_CENT) : 0
}

export function centsToMillicents(cents: number): number {
  return Number.isFinite(cents) ? Math.round(cents) * AI_MILLICENTS_PER_CENT : 0
}

/**
 * Conversa típica assumida para projeção e para a tabela de planos: 8 idas e
 * vindas, com o prompt de sistema e a ficha do imóvel em cache (escrito uma vez,
 * lido nas demais), mais o histórico curto de cada turno.
 */
export const AI_TYPICAL_CONVERSATION = {
  turns: 8,
  cacheWriteTokens: 2_000,
  cacheReadTokensPerTurn: 2_000,
  inputTokensPerTurn: 600,
  outputTokensPerTurn: 250,
} as const

/** Requisição avulsa típica (redigir anúncio, resumir conversa, sugerir resposta). */
export const AI_TYPICAL_REQUEST = { inputTokens: 1_500, outputTokens: 500 } as const

export function typicalConversationTokens(): Required<AiTokenUsage> {
  const t = AI_TYPICAL_CONVERSATION

  return {
    inputTokens: t.inputTokensPerTurn * t.turns,
    outputTokens: t.outputTokensPerTurn * t.turns,
    // O primeiro turno escreve o cache; os demais leem.
    cacheWriteTokens: t.cacheWriteTokens,
    cacheReadTokens: t.cacheReadTokensPerTurn * Math.max(0, t.turns - 1),
  }
}

/** Custo da conversa típica, em millicents. */
export function typicalConversationCostMillicents(rate = AI_EXCHANGE_RATE_DEFAULT): number {
  return aiCostMillicents(typicalConversationTokens(), rate)
}

/** Custo da requisição avulsa típica, em millicents. */
export function typicalRequestCostMillicents(rate = AI_EXCHANGE_RATE_DEFAULT): number {
  return aiCostMillicents(AI_TYPICAL_REQUEST, rate)
}

/** Projeção de custo do ciclo, em millicents, para N conversas e M requisições avulsas. */
export function projectAiCostMillicents(
  volume: { conversations?: number; requests?: number },
  rate = AI_EXCHANGE_RATE_DEFAULT
): number {
  const conversations = Math.max(0, Math.floor(volume.conversations ?? 0))
  const requests = Math.max(0, Math.floor(volume.requests ?? 0))

  return (
    conversations * typicalConversationCostMillicents(rate) +
    requests * typicalRequestCostMillicents(rate)
  )
}

/** Quantas conversas típicas cabem num teto (em centavos). */
export function conversationsWithinCapCents(
  capCents: number,
  rate = AI_EXCHANGE_RATE_DEFAULT
): number {
  const cost = typicalConversationCostMillicents(rate)
  return cost > 0 ? Math.floor(centsToMillicents(Math.max(0, capCents)) / cost) : 0
}

// ---------------------------------------------------------------------------
// 6. Decisão: liberar ou bloquear
// ---------------------------------------------------------------------------

export type AiBlockReason =
  | "billing_blocked"
  | "feature_unavailable"
  | "request_too_large"
  | "rate_limited_organization"
  | "rate_limited_user"
  | "daily_cost_cap"
  | "weekly_cost_cap"
  | "cycle_cost_cap"
  | "quota_exhausted"
  | "overage_cap"

/** Estados em que a IA roda. Carência e modo leitura bloqueiam: IA é dinheiro saindo. */
export const AI_ALLOWED_BILLING_STATES: readonly BillingState[] = ["trialing", "active"]

export type AiQuotaState = {
  planKey: BillingPlanKey
  billingState: BillingState
  /** Franquia de conversas do ciclo (-1 = ilimitada, 0 = não inclusa). */
  conversationsLimit: number
  conversationsUsed: number
  costMillicents: number
  dayCostMillicents: number
  weekCostMillicents: number
  /** Teto de excedente em centavos, definido pela imobiliária (0 = sem excedente). */
  overageCapCents: number
}

export type AiQuotaRequest = {
  kind: AiUsageKind
  units?: number
  /** Custo estimado da chamada, cobrado antes de acionar o modelo. */
  estimatedCostMillicents: number
}

export type AiQuotaDecision = {
  allowed: boolean
  reason: AiBlockReason | null
  /** true quando esta chamada já está além da franquia ou do teto do plano. */
  inOverage: boolean
  conversationsLimit: number
  conversationsUsed: number
  /** null quando a franquia é ilimitada. */
  conversationsRemaining: number | null
  costMillicents: number
  planCapMillicents: number
  overageCapMillicents: number
  /** Teto efetivo do ciclo: plano + excedente autorizado pela imobiliária. */
  effectiveCapMillicents: number
  remainingMillicents: number
  dayCapMillicents: number
  weekCapMillicents: number
}

/** Tokens acima do teto por requisição: recusar antes de chamar o modelo. */
export function isAiRequestTooLarge(usage: AiTokenUsage): boolean {
  return (
    tokens(usage.inputTokens) > AI_MAX_INPUT_TOKENS ||
    tokens(usage.outputTokens) > AI_MAX_OUTPUT_TOKENS
  )
}

/**
 * Mesma regra de `private.ai_quota_decision` no banco (o banco é quem bloqueia;
 * aqui é para projetar, explicar e testar). Ordem dos cortes:
 *  1. assinatura fora de trialing/active;
 *  2. teto do dia; 3. teto da semana (calculados sobre o teto efetivo do ciclo);
 *  4. teto do ciclo (plano + excedente);
 *  5. franquia de conversas.
 * Rajada e tamanho da requisição são checados antes, fora daqui.
 */
export function resolveAiQuota(state: AiQuotaState, request: AiQuotaRequest): AiQuotaDecision {
  const planCap = centsToMillicents(aiCostCapCents(state.planKey))
  const overageCap = centsToMillicents(Math.max(0, state.overageCapCents))
  const effectiveCap = planCap + overageCap
  const dayCap = centsToMillicents(aiDailyCapCents(millicentsToCents(effectiveCap)))
  const weekCap = centsToMillicents(aiWeeklyCapCents(millicentsToCents(effectiveCap)))

  const cost = Math.max(0, state.costMillicents)
  const requestCost = Math.max(0, request.estimatedCostMillicents)
  const units = aiUnitsFor(request.kind, request.units ?? 1)
  const limit = state.conversationsLimit
  const unlimited = limit < 0
  const used = Math.max(0, state.conversationsUsed)
  const remaining = unlimited ? null : Math.max(0, limit - used)

  const base: Omit<AiQuotaDecision, "allowed" | "reason" | "inOverage"> = {
    conversationsLimit: limit,
    conversationsUsed: used,
    conversationsRemaining: remaining,
    costMillicents: cost,
    planCapMillicents: planCap,
    overageCapMillicents: overageCap,
    effectiveCapMillicents: effectiveCap,
    remainingMillicents: Math.max(0, effectiveCap - cost),
    dayCapMillicents: dayCap,
    weekCapMillicents: weekCap,
  }

  // Além da franquia comercial ou além do teto do plano: só com excedente ligado.
  const beyondFranchise = !unlimited && used + units > limit
  const beyondPlanCap = cost + requestCost > planCap
  const inOverage = beyondFranchise || beyondPlanCap

  const deny = (reason: AiBlockReason): AiQuotaDecision => ({
    ...base,
    allowed: false,
    reason,
    inOverage,
  })

  if (!AI_ALLOWED_BILLING_STATES.includes(state.billingState)) {
    return deny("billing_blocked")
  }

  if (limit === 0) {
    return deny("feature_unavailable")
  }

  if (Math.max(0, state.dayCostMillicents) + requestCost > dayCap) {
    return deny("daily_cost_cap")
  }

  if (Math.max(0, state.weekCostMillicents) + requestCost > weekCap) {
    return deny("weekly_cost_cap")
  }

  if (cost + requestCost > effectiveCap) {
    // Sem excedente ligado, o corte é o teto do plano; com excedente, é o teto somado.
    return deny(overageCap > 0 ? "overage_cap" : "cycle_cost_cap")
  }

  if (beyondFranchise && overageCap === 0) {
    return deny("quota_exhausted")
  }

  return { ...base, allowed: true, reason: null, inOverage }
}

// ---------------------------------------------------------------------------
// 7. Avisos de franquia
// ---------------------------------------------------------------------------

/** A partir desta fração do consumo do ciclo sai o aviso por e-mail. */
export const AI_USAGE_WARNING_RATIO = 0.8

/**
 * Fração consumida do ciclo: a maior entre franquia de conversas e teto em reais
 * (o que estiver mais perto de bloquear é o que interessa avisar). Franquia
 * ilimitada e teto zero não contam.
 */
export function aiUsageRatio(state: {
  conversationsLimit: number
  conversationsUsed: number
  costMillicents: number
  capMillicents: number
}): number {
  const byUnits =
    state.conversationsLimit > 0
      ? Math.max(0, state.conversationsUsed) / state.conversationsLimit
      : 0
  const byCost =
    state.capMillicents > 0 ? Math.max(0, state.costMillicents) / state.capMillicents : 0

  return Math.max(byUnits, byCost)
}

export type AiUsageNoticeLevel = "80" | "100"

/** Nível do aviso a enviar (um de cada por ciclo), ou null se ainda não chegou lá. */
export function aiUsageNoticeLevel(ratio: number): AiUsageNoticeLevel | null {
  if (!Number.isFinite(ratio)) {
    return null
  }

  if (ratio >= 1) {
    return "100"
  }

  return ratio >= AI_USAGE_WARNING_RATIO ? "80" : null
}

// ---------------------------------------------------------------------------
// 8. Tabela de referência por plano (usada na tela de planos e no relatório)
// ---------------------------------------------------------------------------

export type AiPlanAllowance = {
  plan: BillingPlanKey
  /** Franquia de conversas do plano (limits.ai_conversations). */
  conversations: number
  cycleCapCents: number
  dailyCapCents: number
  weeklyCapCents: number
  /** Quantas conversas típicas o teto em reais comporta. */
  conversationsWithinCap: number
  /** Custo do ciclo se a franquia inteira for usada em conversas típicas. */
  franchiseCostCents: number
}

export function aiPlanAllowance(
  plan: BillingPlanKey,
  conversations: number,
  rate = AI_EXCHANGE_RATE_DEFAULT
): AiPlanAllowance {
  const cycleCapCents = aiCostCapCents(plan)

  return {
    plan,
    conversations,
    cycleCapCents,
    dailyCapCents: aiDailyCapCents(cycleCapCents),
    weeklyCapCents: aiWeeklyCapCents(cycleCapCents),
    conversationsWithinCap: conversationsWithinCapCents(cycleCapCents, rate),
    franchiseCostCents: millicentsToCents(
      projectAiCostMillicents({ conversations: Math.max(0, conversations) }, rate)
    ),
  }
}

/** Franquia e tetos dos 4 planos pagos (o teste grátis vem de TRIAL_LIMITS). */
export function aiPlanAllowances(rate = AI_EXCHANGE_RATE_DEFAULT): AiPlanAllowance[] {
  return (Object.keys(PLANS) as PlanKey[]).map((plan) =>
    aiPlanAllowance(plan, PLANS[plan].limits.ai_conversations, rate)
  )
}
