import { describe, expect, it } from "vitest"

import { FEATURE_KEYS, featuresForPlan } from "./features"
import { LIMIT_KEYS } from "./limits"
import {
  ADDONS,
  AI_OVERAGE_NOTE,
  ANNUAL_BOLETO_NOTE,
  BILLING_INTERVALS,
  GRACE_DAYS,
  PLAN_CONDITIONS,
  PLAN_KEYS,
  PLANS,
  STORAGE_FAIR_USE_NOTE,
  TRIAL_AI_CONVERSATIONS,
  TRIAL_DAYS,
  TRIAL_LIMITS,
  clampExtraSeats,
  isBillingInterval,
  isBillingPlanKey,
  isPlanKey,
  maxExtraSeats,
  parseLookupKey,
  planTotal,
  priceLookupKey,
  seatLookupKey,
} from "./plans"

describe("PLANS", () => {
  it("segue a tabela de preços do contrato, em centavos", () => {
    expect(PLANS.corretor.prices).toEqual({ month: 8900, year: 89000 })
    expect(PLANS.imobiliaria.prices).toEqual({ month: 24900, year: 249000 })
    expect(PLANS.equipe.prices).toEqual({ month: 59900, year: 599000 })
    expect(PLANS.rede.prices).toEqual({ month: 149000, year: 1490000 })

    expect(PLANS.corretor.seatPrice).toEqual({ month: 3900, year: 39000 })
    expect(PLANS.imobiliaria.seatPrice).toEqual({ month: 3900, year: 39000 })
    expect(PLANS.equipe.seatPrice).toEqual({ month: 3500, year: 35000 })
    expect(PLANS.rede.seatPrice).toEqual({ month: 2900, year: 29000 })
  })

  it("cobra o anual como 10 mensalidades (2 meses grátis)", () => {
    for (const plan of PLAN_KEYS) {
      expect(PLANS[plan].prices.year).toBe(PLANS[plan].prices.month * 10)
      expect(PLANS[plan].seatPrice.year).toBe(PLANS[plan].seatPrice.month * 10)
    }
  })

  it("segue os limites da tabela do contrato", () => {
    expect(PLANS.corretor.limits).toEqual({
      users: 1,
      landing_pages: 3,
      storage_gb: 10,
      pipelines: 1,
      ai_conversations: 30,
      whatsapp_numbers: 1,
      rental_contracts: 0,
      esign_docs: 5,
      branches: 1,
    })
    expect(PLANS.imobiliaria.limits).toEqual({
      users: 3,
      landing_pages: 15,
      storage_gb: 30,
      pipelines: 3,
      ai_conversations: 100,
      whatsapp_numbers: 1,
      rental_contracts: 20,
      esign_docs: 15,
      branches: 1,
    })
    expect(PLANS.equipe.limits).toEqual({
      users: 8,
      landing_pages: 50,
      storage_gb: 100,
      pipelines: 10,
      ai_conversations: 250,
      whatsapp_numbers: 3,
      rental_contracts: 100,
      esign_docs: 40,
      branches: 1,
    })
    expect(PLANS.rede.limits).toEqual({
      users: 20,
      landing_pages: -1,
      storage_gb: 300,
      pipelines: -1,
      ai_conversations: 600,
      whatsapp_numbers: 10,
      rental_contracts: 300,
      esign_docs: 100,
      branches: 5,
    })
  })

  it("mantém usuários, chave e teto coerentes", () => {
    expect(PLANS.corretor.usersMax).toBe(2)
    for (const plan of PLAN_KEYS) {
      const definition = PLANS[plan]
      expect(definition.key).toBe(plan)
      expect(definition.limits.users).toBe(definition.usersIncluded)
      expect(Object.keys(definition.limits).sort()).toEqual([...LIMIT_KEYS].sort())
      if (plan !== "corretor") {
        expect(definition.usersMax).toBe(-1)
      }
    }
  })

  it("deriva os recursos de FEATURES, na ordem do catálogo", () => {
    for (const plan of PLAN_KEYS) {
      expect(PLANS[plan].features).toEqual(featuresForPlan(plan))
      const order = PLANS[plan].features.map((feature) => FEATURE_KEYS.indexOf(feature))
      expect(order).toEqual([...order].sort((a, b) => a - b))
    }
  })

  it("traz textos de venda em pt-BR com o preço formatado", () => {
    expect(PLANS.corretor.name).toBe("Corretor")
    expect(PLANS.imobiliaria.name).toBe("Imobiliária")
    expect(PLANS.imobiliaria.highlight).toBe(true)
    expect(PLANS.equipe.benefits.map((benefit) => benefit.text)).toContain(
      "8 usuários incluídos, extra por R$ 35/mês"
    )
    expect(PLANS.corretor.benefits).toContainEqual({
      text: "30 conversas de IA no WhatsApp por mês",
      status: "soon",
    })
    expect(PLANS.rede.benefits.map((benefit) => benefit.text)).toEqual(
      expect.arrayContaining([
        "300 GB para fotos e documentos (uso justo)",
        "600 conversas de IA e 10 números de WhatsApp",
      ])
    )

    for (const plan of PLAN_KEYS) {
      const definition = PLANS[plan]
      expect(definition.audience.trim()).not.toBe("")
      expect(definition.description.trim()).not.toBe("")
      expect(definition.benefits.length).toBeGreaterThan(4)
      expect(definition.support.trim()).not.toBe("")
    }
  })
})

describe("teste grátis", () => {
  it("dura 14 dias com 7 de carência", () => {
    expect(TRIAL_DAYS).toBe(14)
    expect(GRACE_DAYS).toBe(7)
  })

  it("usa os limites do Equipe com 10 conversas de IA", () => {
    expect(TRIAL_AI_CONVERSATIONS).toBe(10)
    expect(TRIAL_LIMITS).toEqual({ ...PLANS.equipe.limits, ai_conversations: 10 })
    expect(TRIAL_LIMITS).toMatchObject({
      users: 8,
      landing_pages: 50,
      storage_gb: 100,
      pipelines: 10,
      ai_conversations: 10,
      esign_docs: 40,
    })
  })
})

describe("ADDONS e condições", () => {
  it("lista os add-ons em breve com preço formatado", () => {
    expect(ADDONS.map((addon) => addon.key)).toEqual([
      "ai_conversations",
      "rental",
      "esign",
      "storage",
      "branch",
      "launches",
    ])
    for (const addon of ADDONS) {
      expect(addon.status).toBe("soon")
      expect(addon.plans.length).toBeGreaterThan(0)
      expect(addon.priceLabel).toContain("R$")
    }
    expect(ADDONS[0]?.priceLabel).toBe(
      "+100 por R$ 119/mês · +500 por R$ 490/mês · +2.000 por R$ 1.990/mês"
    )
    expect(ADDONS.find((addon) => addon.key === "esign")?.priceLabel).toBe(
      "20 documentos por R$ 29/mês · 100 por R$ 149/mês"
    )
    expect(ADDONS.find((addon) => addon.key === "storage")?.priceLabel).toBe("+50 GB por R$ 49/mês")
    expect(ADDONS.find((addon) => addon.key === "branch")?.priceLabel).toBe("R$ 190/mês por loja")
    expect(ADDONS.find((addon) => addon.key === "rental")?.priceLabel).toBe(
      "R$ 1,90 por contrato ativo/mês (mínimo de R$ 19/mês no Corretor)"
    )
    expect(ADDONS.find((addon) => addon.key === "branch")?.plans).toEqual(["rede"])
    expect(ADDONS.find((addon) => addon.key === "launches")?.plans).toEqual([
      "imobiliaria",
      "equipe",
    ])
  })

  it("exibe as condições comerciais", () => {
    expect(PLAN_CONDITIONS[0]).toBe("14 dias de teste grátis, sem cartão")
    expect(PLAN_CONDITIONS.length).toBeGreaterThanOrEqual(8)
  })

  it("exibe as regras de armazenamento, excedente de IA e boleto no anual", () => {
    expect(PLAN_CONDITIONS).toEqual(
      expect.arrayContaining([STORAGE_FAIR_USE_NOTE, AI_OVERAGE_NOTE, ANNUAL_BOLETO_NOTE])
    )
    expect(STORAGE_FAIR_USE_NOTE).toBe(
      "Armazenamento conforme uso justo, com fotos otimizadas automaticamente"
    )
    expect(ANNUAL_BOLETO_NOTE).toBe(
      "No anual dos planos Equipe e Rede, o boleto é a forma padrão sugerida; o cartão continua disponível"
    )
    expect(ADDONS.find((addon) => addon.key === "ai_conversations")?.description).toContain(
      AI_OVERAGE_NOTE
    )
    expect(ADDONS.find((addon) => addon.key === "storage")?.description).toContain(
      STORAGE_FAIR_USE_NOTE
    )
    for (const text of [...PLAN_CONDITIONS, ...ADDONS.map((addon) => addon.description)]) {
      expect(text).not.toMatch(/\bR2\b/)
    }
  })
})

describe("guards", () => {
  it("reconhece chaves de plano e intervalo", () => {
    expect(isPlanKey("equipe")).toBe(true)
    expect(isPlanKey("trial")).toBe(false)
    expect(isPlanKey(undefined)).toBe(false)
    expect(isBillingPlanKey("trial")).toBe(true)
    expect(isBillingPlanKey("ouro")).toBe(false)
    expect(isBillingInterval("month")).toBe(true)
    expect(isBillingInterval("monthly")).toBe(false)
  })
})

describe("lookup keys", () => {
  it("monta as chaves dos Prices", () => {
    expect(priceLookupKey("equipe", "month")).toBe("plan_equipe_monthly")
    expect(priceLookupKey("rede", "year")).toBe("plan_rede_yearly")
    expect(seatLookupKey("corretor", "month")).toBe("seat_corretor_monthly")
    expect(seatLookupKey("imobiliaria", "year")).toBe("seat_imobiliaria_yearly")
  })

  it("faz ida e volta em todas as combinações", () => {
    for (const plan of PLAN_KEYS) {
      for (const interval of BILLING_INTERVALS) {
        expect(parseLookupKey(priceLookupKey(plan, interval))).toEqual({
          kind: "plan",
          plan,
          interval,
        })
        expect(parseLookupKey(seatLookupKey(plan, interval))).toEqual({
          kind: "seat",
          plan,
          interval,
        })
      }
    }
  })

  it("recusa chaves fora do padrão", () => {
    expect(parseLookupKey("plan_trial_monthly")).toBeNull()
    expect(parseLookupKey("plan_ouro_monthly")).toBeNull()
    expect(parseLookupKey("plan_equipe_weekly")).toBeNull()
    expect(parseLookupKey("addon_storage_50gb_monthly")).toBeNull()
    expect(parseLookupKey("addon_launches_monthly")).toBeNull()
    expect(parseLookupKey("PLAN_EQUIPE_MONTHLY")).toBeNull()
    expect(parseLookupKey(" plan_equipe_monthly")).toBeNull()
    expect(parseLookupKey("plan_equipe_monthly_x")).toBeNull()
    expect(parseLookupKey("")).toBeNull()
    expect(parseLookupKey(null as unknown as string)).toBeNull()
  })
})

describe("assentos e totais", () => {
  it("calcula o teto de extras por plano", () => {
    expect(maxExtraSeats("corretor")).toBe(1)
    expect(maxExtraSeats("rede")).toBe(Number.POSITIVE_INFINITY)
  })

  it("normaliza e capa os extras", () => {
    expect(clampExtraSeats("corretor", 5)).toBe(1)
    expect(clampExtraSeats("imobiliaria", 2.9)).toBe(2)
    expect(clampExtraSeats("equipe", -3)).toBe(0)
    expect(clampExtraSeats("equipe", Number.NaN)).toBe(0)
    expect(clampExtraSeats("rede", 40)).toBe(40)
  })

  it("soma plano e extras no intervalo pedido", () => {
    expect(planTotal("imobiliaria", "month")).toBe(24900)
    expect(planTotal("imobiliaria", "month", 2)).toBe(24900 + 2 * 3900)
    expect(planTotal("equipe", "year", 3)).toBe(599000 + 3 * 35000)
    expect(planTotal("corretor", "month", 9)).toBe(8900 + 3900)
  })
})
