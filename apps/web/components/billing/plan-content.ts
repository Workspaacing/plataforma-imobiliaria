// Cálculos de exibição dos planos que dependem do catálogo da Stripe.
// Puro (sem server-only): roda no servidor e no navegador. Catálogo, limites,
// benefícios e textos vêm do core (`@workspace/core/billing`), a fonte única.
import {
  AI_PLAN_NOTE,
  BILLING_INTERVAL_LABELS,
  formatBRL,
  LISTING_PHOTO_MAX_MB,
  maxExtraSeats,
  PLAN_KEYS,
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
export function keyBenefits(plan: PlanKey, max = Number.POSITIVE_INFINITY): PlanBenefit[] {
  return PLANS[plan].benefits.filter((benefit) => !/usuári/i.test(benefit.text)).slice(0, max)
}

/** Plano imediatamente abaixo na ordem do catálogo; null no primeiro. */
export function previousPlan(plan: PlanKey): PlanKey | null {
  const index = PLAN_KEYS.indexOf(plan)
  return index > 0 ? (PLAN_KEYS[index - 1] ?? null) : null
}

/**
 * Benefícios que o plano acrescenta ao anterior ("Tudo do plano X, mais:"): os
 * do core cujo texto não aparece no plano de baixo. Números que mudam (imóveis
 * com foto, conversas de IA, suporte) contam como item novo.
 */
export function planIncrements(plan: PlanKey): PlanBenefit[] {
  const previous = previousPlan(plan)

  if (!previous) {
    return keyBenefits(plan)
  }

  const inherited = new Set(keyBenefits(previous).map((benefit) => benefit.text))
  return keyBenefits(plan).filter((benefit) => !inherited.has(benefit.text))
}

/** Preço mensal equivalente (no anual, o total dividido por 12), em centavos. */
export function monthlyEquivalent(pricing: PlanPricing, interval: BillingInterval) {
  return interval === "year" ? Math.round(pricing.price / 12) : pricing.price
}

/** "R$" seguido de espaço inseparável (código 160). */
const NBSP_PREFIX = `R$${String.fromCharCode(160)}`

/** Usuários incluídos e preço do extra, no intervalo escolhido. */
export function seatsSummary(plan: PlanKey, pricing: PlanPricing, interval: BillingInterval) {
  const details = PLANS[plan]
  const maxExtra = maxExtraSeats(plan)
  const included = pluralize(details.usersIncluded, "usuário incluído", "usuários incluídos")
  // O valor não quebra de linha longe do símbolo.
  const price = formatBRL(pricing.seatPrice, { omitZeroCents: true }).replace(
    /^R\$\s+/,
    NBSP_PREFIX
  )
  const seatPrice = `${price}${BILLING_INTERVAL_LABELS[interval].suffix}`

  if (maxExtra === 0) {
    return `${included}.`
  }

  return Number.isFinite(maxExtra)
    ? `${included}; até ${pluralize(maxExtra, "extra", "extras")} por ${seatPrice} cada.`
    : `${included}; usuário extra por ${seatPrice}.`
}

/** Notas de uso e limites do rodapé do cartão (só regras do catálogo). */
export function planFootnotes(plan: PlanKey): string[] {
  const details = PLANS[plan]
  const notes = [
    details.usersMax === -1
      ? "Sem teto de usuários extras."
      : `No máximo ${pluralize(details.usersMax, "pessoa", "pessoas")} no total.`,
    `Até ${details.limits.photos_per_listing} fotos por imóvel, com ${LISTING_PHOTO_MAX_MB} MB cada.`,
  ]

  if (details.limits.ai_conversations === 0) {
    notes.push(`${AI_PLAN_NOTE}.`)
  }

  return notes
}

/** CTA de venda: cadastro com o plano pré-escolhido. */
export function signUpHref(plan: PlanKey) {
  return `${SIGN_UP_PATH}?${new URLSearchParams({ plano: plan }).toString()}`
}
