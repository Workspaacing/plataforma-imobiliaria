import { describe, expect, it } from "vitest"

import {
  AI_COST_CAP_PCT,
  AI_EXCHANGE_RATES,
  AI_MAX_INPUT_TOKENS,
  AI_MAX_OUTPUT_TOKENS,
  AI_MIN_DAILY_CAP_CENTS,
  AI_MIN_WEEKLY_CAP_CENTS,
  AI_TRIAL_COST_CAP_CENTS,
  AI_USAGE_KINDS,
  AI_USAGE_KIND_LABELS,
  AI_UNIT_WEIGHTS,
  aiCostCapCents,
  aiCostMillicents,
  aiCostUsd,
  aiDailyCapCents,
  aiPlanAllowances,
  aiUnitsFor,
  aiUsageNoticeLevel,
  aiUsageRatio,
  aiWeeklyCapCents,
  centsToMillicents,
  conversationsWithinCapCents,
  isAiRequestTooLarge,
  isAiUsageKind,
  millicentsToCents,
  projectAiCostMillicents,
  resolveAiQuota,
  typicalConversationCostMillicents,
  typicalConversationTokens,
  type AiQuotaState,
} from "./ai-usage"
import { PLANS } from "./plans"
import { TRIAL_AI_CONVERSATIONS } from "./plans"

describe("preços e câmbio", () => {
  it("cobra entrada, saída, escrita e leitura de cache pela tabela do Sonnet 5", () => {
    expect(aiCostUsd({ inputTokens: 1_000_000 })).toBeCloseTo(2, 10)
    expect(aiCostUsd({ outputTokens: 1_000_000 })).toBeCloseTo(10, 10)
    // Leitura de cache: 10% da entrada. Escrita: 1,25x a entrada.
    expect(aiCostUsd({ cacheReadTokens: 1_000_000 })).toBeCloseTo(0.2, 10)
    expect(aiCostUsd({ cacheWriteTokens: 1_000_000 })).toBeCloseTo(2.5, 10)
  })

  it("ignora tokens ausentes, negativos ou inválidos", () => {
    expect(aiCostUsd({})).toBe(0)
    expect(aiCostUsd({ inputTokens: -100, outputTokens: Number.NaN })).toBe(0)
  })

  it("converte em millicents arredondando para cima (nunca contar menos do que custou)", () => {
    // 1.000 tokens de entrada = US$ 0,002 = R$ 0,0112 a 5,60 = 1,12 centavo.
    expect(aiCostMillicents({ inputTokens: 1_000 }, 5.6)).toBe(1_120)
    // 1 token de saída custa fração mínima, mas nunca zero.
    expect(aiCostMillicents({ outputTokens: 1 }, 5.6)).toBeGreaterThan(0)
    // Câmbio inválido cai no padrão em vez de zerar o custo.
    expect(aiCostMillicents({ inputTokens: 1_000 }, 0)).toBe(
      aiCostMillicents({ inputTokens: 1_000 })
    )
  })

  it("o câmbio padrão é o dólar de cartão, mais caro que o PTAX", () => {
    expect(AI_EXCHANGE_RATES.card).toBeGreaterThan(AI_EXCHANGE_RATES.ptax)
    expect(aiCostMillicents({ inputTokens: 100_000 }, AI_EXCHANGE_RATES.card)).toBeGreaterThan(
      aiCostMillicents({ inputTokens: 100_000 }, AI_EXCHANGE_RATES.ptax)
    )
  })

  it("converte entre centavos e millicents", () => {
    expect(centsToMillicents(1335)).toBe(1_335_000)
    expect(millicentsToCents(1_335_000)).toBe(1335)
    expect(millicentsToCents(1_499)).toBe(1)
  })
})

describe("tetos por plano", () => {
  it("usa 15% do preço de tabela mensal, nunca o valor com desconto", () => {
    expect(AI_COST_CAP_PCT).toBe(0.15)
    expect(aiCostCapCents("corretor")).toBe(1335)
    expect(aiCostCapCents("imobiliaria")).toBe(3735)
    expect(aiCostCapCents("equipe")).toBe(8985)
    expect(aiCostCapCents("rede")).toBe(22350)
    expect(aiCostCapCents("trial")).toBe(AI_TRIAL_COST_CAP_CENTS)

    for (const plan of ["corretor", "imobiliaria", "equipe", "rede"] as const) {
      expect(aiCostCapCents(plan)).toBe(Math.round(PLANS[plan].prices.month * AI_COST_CAP_PCT))
    }
  })

  it("recorta o teto do ciclo em dia (1/15) e semana (1/4)", () => {
    expect(aiDailyCapCents(1335)).toBe(89)
    expect(aiWeeklyCapCents(1335)).toBe(334)
    expect(aiDailyCapCents(22350)).toBe(1490)
    expect(aiWeeklyCapCents(22350)).toBe(5588)
    expect(aiDailyCapCents(-10)).toBe(0)
  })

  it("respeita o piso das janelas curtas sem passar do teto do ciclo", () => {
    // Teste grátis: 1/15 de R$ 3,00 não pagaria nem uma conversa.
    expect(aiDailyCapCents(AI_TRIAL_COST_CAP_CENTS)).toBe(AI_MIN_DAILY_CAP_CENTS)
    expect(aiWeeklyCapCents(AI_TRIAL_COST_CAP_CENTS)).toBe(AI_MIN_WEEKLY_CAP_CENTS)
    expect(aiDailyCapCents(20)).toBe(20)
    expect(aiWeeklyCapCents(20)).toBe(20)
  })

  it("a franquia anunciada cabe no teto em reais com a conversa típica", () => {
    for (const allowance of aiPlanAllowances()) {
      expect(allowance.franchiseCostCents).toBeLessThanOrEqual(allowance.cycleCapCents)
      expect(allowance.conversationsWithinCap).toBeGreaterThanOrEqual(allowance.conversations)
    }
  })

  it("o teto do teste grátis comporta a franquia de 10 conversas", () => {
    expect(conversationsWithinCapCents(AI_TRIAL_COST_CAP_CENTS)).toBeGreaterThanOrEqual(
      TRIAL_AI_CONVERSATIONS
    )
  })

  it("o teto do dia comporta ao menos uma conversa típica em todos os planos", () => {
    const caps = [...aiPlanAllowances().map((a) => a.cycleCapCents), AI_TRIAL_COST_CAP_CENTS]

    for (const cap of caps) {
      expect(centsToMillicents(aiDailyCapCents(cap))).toBeGreaterThanOrEqual(
        typicalConversationCostMillicents()
      )
    }
  })
})

describe("tipos de uso e peso", () => {
  it("descreve e pesa todos os tipos", () => {
    expect(Object.keys(AI_USAGE_KIND_LABELS)).toEqual([...AI_USAGE_KINDS])
    expect(Object.keys(AI_UNIT_WEIGHTS)).toEqual([...AI_USAGE_KINDS])
    expect(isAiUsageKind("conversation")).toBe(true)
    expect(isAiUsageKind("qualquer")).toBe(false)
  })

  it("multiplica as unidades pelo peso do tipo", () => {
    expect(aiUnitsFor("conversation")).toBe(AI_UNIT_WEIGHTS.conversation)
    expect(aiUnitsFor("listing_copy", 3)).toBe(3 * AI_UNIT_WEIGHTS.listing_copy)
    expect(aiUnitsFor("reply_suggestion", -2)).toBe(0)
  })
})

describe("tamanho da requisição", () => {
  it("recusa entrada ou saída acima do teto por chamada", () => {
    expect(isAiRequestTooLarge({ inputTokens: AI_MAX_INPUT_TOKENS })).toBe(false)
    expect(isAiRequestTooLarge({ inputTokens: AI_MAX_INPUT_TOKENS + 1 })).toBe(true)
    expect(isAiRequestTooLarge({ outputTokens: AI_MAX_OUTPUT_TOKENS + 1 })).toBe(true)
  })
})

const CONVERSATION_COST = typicalConversationCostMillicents()

function state(overrides: Partial<AiQuotaState> = {}): AiQuotaState {
  return {
    planKey: "imobiliaria",
    billingState: "active",
    conversationsLimit: PLANS.imobiliaria.limits.ai_conversations,
    conversationsUsed: 0,
    costMillicents: 0,
    dayCostMillicents: 0,
    weekCostMillicents: 0,
    overageCapCents: 0,
    ...overrides,
  }
}

const request = { kind: "conversation" as const, estimatedCostMillicents: CONVERSATION_COST }

describe("resolveAiQuota", () => {
  it("libera dentro da franquia e do teto", () => {
    const decision = resolveAiQuota(state(), request)

    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBeNull()
    expect(decision.inOverage).toBe(false)
    expect(decision.conversationsRemaining).toBe(100)
    expect(decision.effectiveCapMillicents).toBe(centsToMillicents(3735))
  })

  it("bloqueia fora de trialing/active (carência, modo leitura, inadimplência)", () => {
    for (const billingState of ["grace", "read_only"] as const) {
      const decision = resolveAiQuota(state({ billingState }), request)
      expect(decision.allowed).toBe(false)
      expect(decision.reason).toBe("billing_blocked")
    }
  })

  it("bloqueia quando o plano não inclui IA (franquia 0)", () => {
    expect(resolveAiQuota(state({ conversationsLimit: 0 }), request).reason).toBe(
      "feature_unavailable"
    )
  })

  it("bloqueia pelo teto do dia antes de qualquer outro teto", () => {
    const decision = resolveAiQuota(
      state({ dayCostMillicents: centsToMillicents(aiDailyCapCents(3735)) }),
      request
    )

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe("daily_cost_cap")
  })

  it("bloqueia pelo teto da semana", () => {
    const decision = resolveAiQuota(
      state({ weekCostMillicents: centsToMillicents(aiWeeklyCapCents(3735)) }),
      request
    )

    expect(decision.reason).toBe("weekly_cost_cap")
  })

  it("bloqueia pelo teto do ciclo mesmo com conversas sobrando na franquia", () => {
    const decision = resolveAiQuota(
      state({ conversationsUsed: 1, costMillicents: centsToMillicents(3735) }),
      request
    )

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe("cycle_cost_cap")
    expect(decision.conversationsRemaining).toBe(99)
    expect(decision.inOverage).toBe(true)
  })

  it("bloqueia ao acabar a franquia quando não há teto de excedente", () => {
    const decision = resolveAiQuota(state({ conversationsUsed: 100 }), request)

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe("quota_exhausted")
    expect(decision.conversationsRemaining).toBe(0)
  })

  it("libera o excedente até o teto em reais definido pela imobiliária", () => {
    const allowed = resolveAiQuota(
      state({ conversationsUsed: 100, overageCapCents: 2000 }),
      request
    )

    expect(allowed.allowed).toBe(true)
    expect(allowed.inOverage).toBe(true)
    expect(allowed.effectiveCapMillicents).toBe(centsToMillicents(3735 + 2000))

    const blocked = resolveAiQuota(
      state({
        conversationsUsed: 200,
        overageCapCents: 2000,
        costMillicents: centsToMillicents(3735 + 2000),
      }),
      request
    )

    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toBe("overage_cap")
  })

  it("franquia ilimitada ainda respeita o teto em reais", () => {
    const decision = resolveAiQuota(
      state({ conversationsLimit: -1, costMillicents: centsToMillicents(3735) }),
      request
    )

    expect(decision.conversationsRemaining).toBeNull()
    expect(decision.reason).toBe("cycle_cost_cap")
  })

  it("cobra a estimativa antes da chamada, então duas requisições simultâneas não furam o teto", () => {
    const almostFull = centsToMillicents(3735) - CONVERSATION_COST
    const first = resolveAiQuota(state({ costMillicents: almostFull }), request)
    // A segunda chega depois de a primeira já ter debitado a estimativa.
    const second = resolveAiQuota(
      state({ costMillicents: almostFull + CONVERSATION_COST }),
      request
    )

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(false)
  })
})

describe("projeção e avisos", () => {
  it("projeta o custo do ciclo por volume", () => {
    expect(projectAiCostMillicents({ conversations: 100 })).toBe(100 * CONVERSATION_COST)
    expect(projectAiCostMillicents({})).toBe(0)
  })

  it("assume 8 turnos com cache lido nos turnos seguintes", () => {
    expect(typicalConversationTokens()).toEqual({
      inputTokens: 4_800,
      outputTokens: 2_000,
      cacheWriteTokens: 2_000,
      cacheReadTokens: 14_000,
    })
  })

  it("usa a maior fração entre conversas e reais", () => {
    expect(
      aiUsageRatio({
        conversationsLimit: 100,
        conversationsUsed: 50,
        costMillicents: 900,
        capMillicents: 1000,
      })
    ).toBe(0.9)

    expect(
      aiUsageRatio({
        conversationsLimit: -1,
        conversationsUsed: 500,
        costMillicents: 0,
        capMillicents: 0,
      })
    ).toBe(0)
  })

  it("avisa em 80% e em 100%", () => {
    expect(aiUsageNoticeLevel(0.79)).toBeNull()
    expect(aiUsageNoticeLevel(0.8)).toBe("80")
    expect(aiUsageNoticeLevel(0.99)).toBe("80")
    expect(aiUsageNoticeLevel(1)).toBe("100")
    expect(aiUsageNoticeLevel(Number.NaN)).toBeNull()
  })
})
