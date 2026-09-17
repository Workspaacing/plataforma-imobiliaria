// Cálculos de exibição dos planos que dependem do catálogo da Stripe.
// Puro (sem server-only): roda no servidor e no navegador. Catálogo, limites,
// benefícios e textos vêm do core (`@workspace/core/billing`), a fonte única.
import {
  PLANS,
  priceLookupKey,
  seatLookupKey,
  type BillingInterval,
  type PlanBenefit,
  type PlanKey,
} from "@workspace/core/billing"

import { SIGN_UP_PATH } from "@/lib/auth/routes"

/** Preços por `lookup_key`, em centavos (ver getCatalogPrices). */
export type CatalogPrices = Record<string, number>

export type PlanPricing = {
  /** Preço do plano no intervalo, em centavos. */
  price: number
  /** Preço de cada usuário extra no intervalo, em centavos. */
  seatPrice: number
}

function isCents(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

/** Preço do catálogo da Stripe; sem ele (ou inválido), o preço do core. */
export function resolvePlanPricing(
  prices: CatalogPrices,
  plan: PlanKey,
  interval: BillingInterval
): PlanPricing {
  const price = prices[priceLookupKey(plan, interval)]
  const seatPrice = prices[seatLookupKey(plan, interval)]

  return {
    price: isCents(price) ? price : PLANS[plan].prices[interval],
    seatPrice: isCents(seatPrice) ? seatPrice : PLANS[plan].seatPrice[interval],
  }
}

/** Total do intervalo com os usuários extras, em centavos. */
export function totalWithSeats(pricing: PlanPricing, extraSeats: number): number {
  return pricing.price + pricing.seatPrice * extraSeats
}

const integer = new Intl.NumberFormat("pt-BR")

export function pluralize(count: number, singular: string, plural: string) {
  return `${integer.format(count)} ${count === 1 ? singular : plural}`
}

/**
 * Benefícios-chave do cartão: os do core, sem a linha de usuários (o cartão
 * mostra usuários e preço do extra no intervalo e no catálogo escolhidos).
 */
export function keyBenefits(plan: PlanKey, max = 8): PlanBenefit[] {
  return PLANS[plan].benefits.filter((benefit) => !/usuári/i.test(benefit.text)).slice(0, max)
}

/** CTA de venda: cadastro com o plano pré-escolhido. */
export function signUpHref(plan: PlanKey) {
  return `${SIGN_UP_PATH}?${new URLSearchParams({ plano: plan }).toString()}`
}
