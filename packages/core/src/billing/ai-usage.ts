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
 * Preço oficial em US$ por milhão de tokens (Sonnet 5, conferido em 2026-09-16 em
 * platform.claude.com/docs/en/about-claude/pricing): entrada 2,00; saída 10,00;
 * leitura de cache 0,20 (10% da entrada); escrita de cache de 5 min 2,50 (1,25x).
 *
 * O banco guarda um único preço de escrita (o de 5 min). A escrita de 1 hora
 * custa 4,00 (2x a entrada) e por isso NUNCA vai direto para `cacheWriteTokens`:
 * passe o `usage` da API por `aiUsageFromApi`, que converte.
 */
export const AI_PRICE_USD_PER_MTOK = {
  input: 2,
  output: 10,
  cacheRead: 0.2,
  cacheWrite: 2.5,
} as const

/** Escrita de cache de 1 hora (US$ por milhão). Só usada na conversão de `aiUsageFromApi`. */
export const AI_PRICE_CACHE_WRITE_1H_USD_PER_MTOK = 4

/**
 * Câmbio configurável. `ptax` é a cotação oficial do dia consultado; `card` é o
 * dólar efetivo de cartão (com IOF e spread), que é o que a empresa paga de fato.
 * O padrão é o `card`: superestimar o câmbio protege a margem.
 */
export const AI_EXCHANGE_RATES = { ptax: 5.1523, card: 5.6675 } as const
/**
 * Política de câmbio: o valor usado na medição é sempre **10% acima da cotação
 * oficial do dia em que foi conferido**. Não é palpite — um pagamento
 * internacional em cartão embute IOF e spread, que juntos dão ~8,8%; os 10%
 * cobrem isso e deixam 1,2% de folga.
 *
 * Subestimar o câmbio é a forma mais silenciosa de ter prejuízo com IA: o corte
 * acontece em reais, então um dólar mais caro que o previsto significa gastar
 * mais dólares do que o teto autorizava. Ao atualizar `ptax`, recalcule `card`
 * como ptax × 1,10 e ajuste AI_PRICING_CHECKED_AT.
 */
export const AI_EXCHANGE_RATE_DEFAULT: number = AI_EXCHANGE_RATES.card

// ---------------------------------------------------------------------------
// 2. Tetos de custo por plano
// ---------------------------------------------------------------------------

/**
 * Fatia do preço de tabela do plano que pode virar custo de IA num ciclo.
 *
 * Era 15%. Subiu para 20% em 16/09/2026 (decisão do dono) quando a conversa
 * típica foi recalculada com o comportamento real do Sonnet 5: com 15%, Equipe e
 * Rede batiam o teto antes de entregar a franquia anunciada (~159 de 200 e ~396
 * de 500). Com 20% as três franquias cabem e todo plano segue com lucro no pior
 * caso. Ajuste aqui (um número só) e em private.ai_cost_cap_cents() no SQL.
 */
export const AI_COST_CAP_PCT = 0.2

/**
 * Teto do teste grátis em centavos (o trial não paga nada: valor fixo e pequeno).
 * R$ 6,00 desde 16/09/2026: é o que as 10 conversas prometidas no teste custam
 * na conversa típica recalculada (antes, R$ 3,00 pagava só ~5).
 */
export const AI_TRIAL_COST_CAP_CENTS = 600

/** O teto do ciclo também vale por dia (1/N) e por semana (1/M): ninguém queima o mês num dia. */
export const AI_DAILY_CAP_DIVISOR = 15
export const AI_WEEKLY_CAP_DIVISOR = 4

/**
 * Piso das janelas curtas, em centavos. Sem ele, num teto de ciclo pequeno (o
 * teste grátis) a fração diária não pagaria nem uma conversa e o corte do dia
 * viraria o corte real. O piso só afrouxa o ritmo: nunca passa do teto do
 * ciclo, que continua sendo o limite de gasto.
 */
export const AI_MIN_DAILY_CAP_CENTS = 100
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
  if (plan === "trial") {
    return AI_TRIAL_COST_CAP_CENTS
  }

  // Plano sem franquia de IA (Corretor) não tem teto a autorizar: nada pode ser
  // gasto. A franquia 0 já bloqueia antes, mas o teto zero fecha a segunda porta.
  return PLANS[plan].limits.ai_conversations === 0
    ? 0
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
 * O excedente de IA só pode existir quando houver como COBRÁ-LO. Hoje os
 * add-ons de conversa extra estão como "em breve" (ADDONS em plans.ts) e não há
 * preço na Stripe, então autorizar excedente significaria a imobiliária
 * autorizar **a nossa empresa** a gastar por ela — dinheiro saindo sem nota
 * entrando. Enquanto esta constante for false, o teto de excedente é zero e a
 * IA para exatamente no teto do plano.
 *
 * Para ligar: crie os preços na Stripe, implemente a cobrança do excedente no
 * fechamento do ciclo e só então mude para true.
 */
export const AI_OVERAGE_BILLING_AVAILABLE = false

/**
 * Maior teto de excedente que a imobiliária pode definir por ciclo, em centavos.
 * R$ 5.000,00 é a trava contra erro de digitação, mas ela só vale quando a
 * cobrança existir — sem isso o máximo é zero.
 */
export const AI_MAX_OVERAGE_CAP_LIMIT_CENTS = 500_000
export const AI_MAX_OVERAGE_CAP_CENTS = AI_OVERAGE_BILLING_AVAILABLE
  ? AI_MAX_OVERAGE_CAP_LIMIT_CENTS
  : 0

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

/**
 * Como cada tipo de uso chama o modelo. Conferido em 2026-09-16 nas páginas
 * oficiais de effort, thinking e prompt caching (platform.claude.com/docs).
 *
 * Três fatos do Sonnet 5 que mandam aqui:
 *  - Sem o campo `thinking`, o raciocínio adaptativo LIGA sozinho, e o effort
 *    padrão é `high` ("almost always thinks"). Raciocínio é cobrado como saída
 *    (US$ 10/milhão) mesmo quando não aparece. Por isso o effort é sempre
 *    explícito: omitir é pagar o nível mais caro por padrão.
 *  - A documentação recomenda `low` para "chat and non-coding use cases" de alto
 *    volume, e `medium` como degrau de economia quando a qualidade pesa mais.
 *  - Trocar o effort no meio da conversa invalida o cache: o nível é por tipo de
 *    uso e fica fixo durante a conversa inteira.
 *
 * `maxTokens` é o teto de saída TOTAL da chamada (raciocínio + texto). Se a
 * resposta vier com `stop_reason: "max_tokens"`, o texto veio cortado: não envie
 * ao cliente; registre e devolva para o corretor.
 *
 * `temperature`, `top_p` e `top_k` não entram: no Sonnet 5 qualquer valor fora do
 * padrão devolve erro 400.
 */
export type AiRequestProfile = {
  effort: "low" | "medium" | "high"
  maxTokens: number
  /**
   * `1h` quando o intervalo entre chamadas costuma passar de 5 minutos (cliente
   * respondendo no WhatsApp). Escrita de 1 h custa 2x a entrada e se paga a
   * partir da segunda leitura; `5m` custa 1,25x e se paga na primeira.
   */
  cacheTtl: "5m" | "1h"
  /** Pode ir pela Batch API (50% de desconto, resposta em até 24 h) quando for em lote. */
  batchable: boolean
}

export const AI_REQUEST_PROFILES: Record<AiUsageKind, AiRequestProfile> = {
  // Atendimento no WhatsApp: alto volume, resposta curta, precisa ser rápido.
  conversation: {
    effort: "low",
    maxTokens: AI_MAX_OUTPUT_TOKENS,
    cacheTtl: "1h",
    batchable: false,
  },
  // Texto de anúncio é vitrine: um degrau acima, e em lote (imóveis importados) vai pela Batch API.
  listing_copy: {
    effort: "medium",
    maxTokens: AI_MAX_OUTPUT_TOKENS,
    cacheTtl: "5m",
    batchable: true,
  },
  conversation_summary: {
    effort: "low",
    maxTokens: AI_MAX_OUTPUT_TOKENS,
    cacheTtl: "5m",
    batchable: true,
  },
  reply_suggestion: {
    effort: "low",
    maxTokens: AI_MAX_OUTPUT_TOKENS,
    cacheTtl: "5m",
    batchable: false,
  },
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

/**
 * Campo `usage` da resposta da Messages API, só com o que a medição lê.
 * `output_tokens` já inclui os tokens de raciocínio (thinking), que são cobrados
 * como saída mesmo quando não aparecem na resposta.
 */
export type AnthropicUsage = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_creation?: {
    ephemeral_5m_input_tokens?: number | null
    ephemeral_1h_input_tokens?: number | null
  } | null
}

/**
 * Converte o `usage` da API para o formato que o banco mede.
 *
 * O banco tem um preço só de escrita de cache (5 min). A escrita de 1 hora custa
 * 1,6x isso, então ela entra convertida em tokens equivalentes de 5 min,
 * arredondando para cima. Quando a API não detalha a escrita por duração, tudo é
 * tratado como 1 hora: na dúvida, medir a mais, nunca a menos.
 */
export function aiUsageFromApi(usage: AnthropicUsage | null | undefined): Required<AiTokenUsage> {
  const written = tokens(usage?.cache_creation_input_tokens ?? undefined)
  const detail = usage?.cache_creation
  const fiveMinutes = detail ? tokens(detail.ephemeral_5m_input_tokens ?? undefined) : 0
  // Sem detalhe, ou detalhe que não fecha com o total: o que sobra conta como 1 h.
  const oneHour = Math.max(
    detail ? tokens(detail.ephemeral_1h_input_tokens ?? undefined) : 0,
    written - fiveMinutes
  )
  const oneHourAsFiveMinutes = Math.ceil(
    (oneHour * AI_PRICE_CACHE_WRITE_1H_USD_PER_MTOK) / AI_PRICE_USD_PER_MTOK.cacheWrite
  )

  return {
    inputTokens: tokens(usage?.input_tokens ?? undefined),
    outputTokens: tokens(usage?.output_tokens ?? undefined),
    cacheReadTokens: tokens(usage?.cache_read_input_tokens ?? undefined),
    cacheWriteTokens: fiveMinutes + oneHourAsFiveMinutes,
  }
}

/** Millicents → centavos, para exibir. */
export function millicentsToCents(millicents: number): number {
  return Number.isFinite(millicents) ? Math.round(millicents / AI_MILLICENTS_PER_CENT) : 0
}

export function centsToMillicents(cents: number): number {
  return Number.isFinite(cents) ? Math.round(cents) * AI_MILLICENTS_PER_CENT : 0
}

/**
 * Conversa típica assumida para projeção e para a tabela de planos (ESTIMATIVA
 * conservadora, recalculada em 16/09/2026 — troque por média medida assim que
 * houver tráfego real em `ai_usage_periods`). 8 idas e vindas no perfil
 * `AI_REQUEST_PROFILES.conversation`, em tokens já convertidos para a régua do
 * banco (escrita de 1 h vira equivalente de 5 min, ver `aiUsageFromApi`):
 *
 *  - 1ª mensagem grava em cache de 1 h ferramentas, instruções e ficha do imóvel
 *    (~3.400 tokens reais → 5.400 equivalentes);
 *  - a cada mensagem seguinte o HISTÓRICO inteiro é reenviado: o que já estava
 *    em cache é lido (10% do preço) e o que entrou de novo é gravado. Uma em cada
 *    dez respostas do cliente chega depois de 1 h e regrava tudo;
 *  - saída = texto (~325) + raciocínio em effort `low` (~120). Raciocínio é
 *    cobrado como saída mesmo sem aparecer.
 *
 * Os números antigos (600 de entrada, 250 de saída, R$ 0,21) ignoravam três
 * coisas documentadas do Sonnet 5: raciocínio ligado por padrão, tokenizador que
 * gera ~30% mais tokens e o histórico que cresce a cada turno.
 */
export const AI_TYPICAL_CONVERSATION = {
  turns: 8,
  cacheWriteTokens: 5_400,
  cacheWriteTokensPerTurn: 2_200,
  cacheReadTokensPerTurn: 5_400,
  inputTokensPerTurn: 150,
  outputTokensPerTurn: 445,
} as const

/**
 * Requisição avulsa típica (redigir anúncio, resumir conversa, sugerir resposta),
 * com o tokenizador do Sonnet 5 e o raciocínio do perfil incluídos. Estimativa.
 */
export const AI_TYPICAL_REQUEST = { inputTokens: 2_000, outputTokens: 900 } as const

export function typicalConversationTokens(): Required<AiTokenUsage> {
  const t = AI_TYPICAL_CONVERSATION
  const laterTurns = Math.max(0, t.turns - 1)

  return {
    inputTokens: t.inputTokensPerTurn * t.turns,
    outputTokens: t.outputTokensPerTurn * t.turns,
    // O primeiro turno grava o prefixo fixo; os seguintes leem o que já está em
    // cache e gravam o que entrou de novo.
    cacheWriteTokens: t.cacheWriteTokens + t.cacheWriteTokensPerTurn * laterTurns,
    cacheReadTokens: t.cacheReadTokensPerTurn * laterTurns,
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
  // Excedente gravado antes de a cobrança existir não vale: sem preço na Stripe
  // ele seria gasto nosso sem receita. A trava é aqui e também no banco.
  const overageCap = AI_OVERAGE_BILLING_AVAILABLE
    ? centsToMillicents(Math.max(0, state.overageCapCents))
    : 0
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
