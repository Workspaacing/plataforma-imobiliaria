import { describe, expect, it } from "vitest"

import { PLANS, maxExtraSeats } from "./plans"
import { recommendPlan } from "./recommend"

const base = { doesRentals: false, leadsPerMonth: 50 }

describe("recommendPlan: tamanho da equipe", () => {
  it("1 pessoa → Corretor, com totais e economia anual", () => {
    expect(recommendPlan({ ...base, teamSize: 1 })).toMatchObject({
      plan: "corretor",
      extraSeats: 0,
      monthlyTotal: 8900,
      yearlyTotal: 89000,
      yearlySavings: 17800,
    })
  })

  it("2 a 5 pessoas → Imobiliária, com extras acima de 3", () => {
    expect(recommendPlan({ ...base, teamSize: 2 })).toMatchObject({
      plan: "imobiliaria",
      extraSeats: 0,
      monthlyTotal: 24900,
    })
    expect(recommendPlan({ ...base, teamSize: 3 }).extraSeats).toBe(0)
    expect(recommendPlan({ ...base, teamSize: 5 })).toMatchObject({
      plan: "imobiliaria",
      extraSeats: 2,
      monthlyTotal: 32700,
      yearlyTotal: 327000,
      yearlySavings: 65400,
    })
  })

  it("6 a 15 pessoas → Equipe, com extras acima de 8", () => {
    expect(recommendPlan({ ...base, teamSize: 6 })).toMatchObject({
      plan: "equipe",
      extraSeats: 0,
      monthlyTotal: 59900,
      yearlyTotal: 599000,
      yearlySavings: 119800,
    })
    expect(recommendPlan({ ...base, teamSize: 15 })).toMatchObject({
      plan: "equipe",
      extraSeats: 7,
      monthlyTotal: 84400,
      yearlyTotal: 844000,
      yearlySavings: 168800,
    })
  })

  it("16+ pessoas → Rede, com extras acima de 20", () => {
    expect(recommendPlan({ ...base, teamSize: 16 })).toMatchObject({
      plan: "rede",
      extraSeats: 0,
      monthlyTotal: 149000,
    })
    expect(recommendPlan({ ...base, teamSize: 25 })).toMatchObject({
      plan: "rede",
      extraSeats: 5,
      monthlyTotal: 163500,
      yearlyTotal: 1635000,
      yearlySavings: 327000,
    })
  })

  it("normaliza tamanho inválido ou fracionado", () => {
    expect(recommendPlan({ ...base, teamSize: 0 }).plan).toBe("corretor")
    expect(recommendPlan({ ...base, teamSize: -4 }).plan).toBe("corretor")
    expect(recommendPlan({ ...base, teamSize: Number.NaN }).plan).toBe("corretor")
    expect(recommendPlan({ ...base, teamSize: 5.2 })).toMatchObject({
      plan: "equipe",
      extraSeats: 0,
    })
  })
})

describe("recommendPlan: locação e volume de leads", () => {
  it("quem faz locação nunca fica no Corretor", () => {
    expect(recommendPlan({ teamSize: 1, doesRentals: true, leadsPerMonth: 10 })).toMatchObject({
      plan: "imobiliaria",
      extraSeats: 0,
      monthlyTotal: 24900,
    })
    expect(recommendPlan({ teamSize: 10, doesRentals: true, leadsPerMonth: 10 }).plan).toBe(
      "equipe"
    )
  })

  it("mais de 300 leads por mês sobe pelo menos para Equipe", () => {
    expect(recommendPlan({ ...base, teamSize: 3, leadsPerMonth: 300 }).plan).toBe("imobiliaria")
    expect(recommendPlan({ ...base, teamSize: 3, leadsPerMonth: 301 })).toMatchObject({
      plan: "equipe",
      extraSeats: 0,
    })
    expect(recommendPlan({ ...base, teamSize: 1, leadsPerMonth: 1000 }).plan).toBe("equipe")
    expect(recommendPlan({ teamSize: 1, doesRentals: true, leadsPerMonth: 500 }).plan).toBe(
      "equipe"
    )
    expect(recommendPlan({ ...base, teamSize: 20, leadsPerMonth: 5000 }).plan).toBe("rede")
  })

  it("ignora volume de leads inválido", () => {
    expect(recommendPlan({ ...base, teamSize: 1, leadsPerMonth: Number.NaN }).plan).toBe("corretor")
  })
})

describe("recommendPlan: coerência", () => {
  it("nunca passa do teto de usuários e fecha as contas", () => {
    for (let teamSize = 1; teamSize <= 40; teamSize++) {
      for (const doesRentals of [false, true]) {
        for (const leadsPerMonth of [0, 301]) {
          const result = recommendPlan({ teamSize, doesRentals, leadsPerMonth })
          const plan = PLANS[result.plan]

          expect(result.extraSeats).toBeLessThanOrEqual(maxExtraSeats(result.plan))
          expect(plan.usersIncluded + result.extraSeats).toBeGreaterThanOrEqual(teamSize)
          expect(result.monthlyTotal).toBe(
            plan.prices.month + result.extraSeats * plan.seatPrice.month
          )
          expect(result.yearlyTotal).toBe(
            plan.prices.year + result.extraSeats * plan.seatPrice.year
          )
          expect(result.yearlySavings).toBe(result.monthlyTotal * 12 - result.yearlyTotal)
          expect(result.yearlySavings).toBeGreaterThan(0)
        }
      }
    }
  })

  it("explica a recomendação em pt-BR", () => {
    expect(recommendPlan({ ...base, teamSize: 1 }).reasons).toEqual([
      "Para 1 pessoa, o indicado é o plano Corretor.",
    ])
    expect(recommendPlan({ teamSize: 1, doesRentals: true, leadsPerMonth: 400 }).reasons).toEqual([
      "Para 1 pessoa, o indicado é o plano Corretor.",
      "Quem faz locação precisa pelo menos do plano Imobiliária.",
      "Com mais de 300 leads por mês, o indicado é pelo menos o plano Equipe.",
    ])
    expect(recommendPlan({ ...base, teamSize: 5 }).reasons).toContain(
      "Inclui 2 usuários extras além dos 3 do plano."
    )
  })
})
