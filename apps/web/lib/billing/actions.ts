"use server"

import { createHash } from "node:crypto"

import type Stripe from "stripe"
import { z } from "zod"

import {
  computeLimits,
  PLANS,
  priceLookupKey,
  seatLookupKey,
  type BillingInterval,
  type PlanKey,
} from "@workspace/core/billing"

import { SUBSCRIPTION_SETTINGS_PATH } from "@/lib/auth/routes"
import { requireMembership, type MembershipContext } from "@/lib/auth/session"
import { couponIdsByDiscount, phaseDiscountParams } from "@/lib/billing/discounts"
import {
  describeBillingError,
  isPortalNotConfiguredError,
  STRIPE_GENERIC_ERROR,
  translateBillingError,
} from "@/lib/billing/errors"
import { getBillingOverview } from "@/lib/billing/queries"
import { referralCouponForCheckout } from "@/lib/billing/referrals"
import { getBillingAccountIds, syncBillingAccount } from "@/lib/billing/rpc"
import { getStripe, isStripeError, isStripeResourceMissing } from "@/lib/billing/stripe"
import {
  describeSubscriptionItems,
  syncSubscriptionFromStripe,
  type SubscriptionComposition,
} from "@/lib/billing/sync"
import { buildTenantUrl } from "@/lib/tenant/urls"

export type BillingActionResult = { ok: true; url: string } | { ok: false; error: string }

export type ChangeSubscriptionResult =
  { ok: true; effective: "now" | "period_end" } | { ok: false; error: string }

export type BillingPortalFlow = "payment_method_update" | "subscription_cancel"

export type SubscriptionChoice = {
  planKey: PlanKey
  interval: BillingInterval
  extraSeats: number
}

type CheckoutLineItem = Stripe.Checkout.SessionCreateParams.LineItem
type SubscriptionItemUpdate = Stripe.SubscriptionUpdateParams.Item
type CatalogPrice = { id: string; amount: number }
type PlanComposition = SubscriptionComposition & {
  plan: NonNullable<SubscriptionComposition["plan"]>
}

const STRIPE_NOT_CONFIGURED =
  "Os pagamentos ainda não estão ativos nesta instalação. Tente novamente mais tarde ou fale com o suporte."
const OWNER_ONLY = "Só o dono da imobiliária pode contratar, trocar ou cancelar a assinatura."
const INVALID_CHOICE =
  "Escolha um plano, o ciclo de cobrança e uma quantidade válida de usuários adicionais."
const INVALID_PORTAL_FLOW = "Opção do portal de pagamentos inválida."
const ACCOUNT_NOT_READY =
  "A assinatura desta imobiliária ainda não está pronta. Tente novamente em instantes ou fale com o suporte."
const PLAN_UNAVAILABLE =
  "Este plano não está disponível para contratação agora. Tente novamente mais tarde ou fale com o suporte."
const PORTAL_NOT_CONFIGURED =
  "O portal de pagamentos está em configuração. Tente novamente mais tarde ou fale com o suporte."
const NO_CUSTOMER = "Ainda não há assinatura contratada. Escolha um plano para começar."
const NO_SUBSCRIPTION = "Não há assinatura para cancelar. Escolha um plano para assinar."
const ALREADY_SUBSCRIBED =
  "Esta imobiliária já tem uma assinatura. Troque o plano, o ciclo ou os usuários na página de assinatura."
const NO_ACTIVE_SUBSCRIPTION =
  "Não há assinatura ativa para alterar. Escolha um plano para assinar."
const PAYMENT_PENDING =
  "Regularize o pagamento pendente em Gerenciar pagamento e faturas antes de trocar de plano."
const CANCELLATION_SCHEDULED =
  "A assinatura está com cancelamento agendado. Reative-a em Gerenciar pagamento e faturas antes de reduzir o plano."
const SAME_CHOICE = "Essa já é a configuração atual da assinatura."
const PLATFORM_BLOCKED =
  "A conta está suspensa pela plataforma, e assinar não a libera. Fale com o suporte antes de contratar ou trocar de plano."
const CURRENT_PLAN_UNKNOWN =
  "Não foi possível identificar o plano atual da assinatura. Fale com o suporte."
const USAGE_UNKNOWN =
  "Não foi possível conferir quantos usuários a imobiliária usa agora. Tente novamente em instantes."

const MAX_EXTRA_SEATS = 500
/** Cliques repetidos na mesma escolha, dentro de 10 min, reaproveitam a mesma operação. */
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000
/** Assinaturas encerradas: contratar de novo passa por um Checkout novo. */
const TERMINAL_STATUSES = new Set(["canceled", "incomplete_expired"])
/** Status em que a troca de plano é aceita (os demais pedem regularizar o pagamento). */
const CHANGEABLE_STATUSES = new Set(["active", "trialing"])

const PLAN_KEYS = Object.keys(PLANS) as [PlanKey, ...PlanKey[]]

const choiceSchema = z.object({
  planKey: z.enum(PLAN_KEYS),
  interval: z.enum(["month", "year"]),
  extraSeats: z.number().int().min(0).max(MAX_EXTRA_SEATS),
})

const portalSchema = z
  .object({ flow: z.enum(["payment_method_update", "subscription_cancel"]).optional() })
  .optional()

type OwnerContext = { ok: true; context: MembershipContext } | { ok: false; error: string }

/** Sessão e imobiliária atual (sem login, redireciona); só o dono age na assinatura. */
async function requireOwner(): Promise<OwnerContext> {
  const context = await requireMembership()

  return context.membership.role === "owner"
    ? { ok: true, context }
    : { ok: false, error: OWNER_ONLY }
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) {
    return null
  }

  return typeof value === "string" ? value : value.id
}

function idempotencyWindow() {
  return Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS)
}

/** Limite de usuários do próprio plano (ex.: Corretor vai até 2). */
function usersMaxError(planKey: PlanKey, extraSeats: number): string | null {
  const plan = PLANS[planKey]

  if (plan.usersMax !== -1 && plan.usersIncluded + extraSeats > plan.usersMax) {
    return `O plano ${plan.name} permite até ${plan.usersMax} usuários. Escolha um plano maior para adicionar mais pessoas.`
  }

  return null
}

function parseChoice(
  input: unknown
): { ok: true; choice: SubscriptionChoice } | { ok: false; error: string } {
  const parsed = choiceSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: INVALID_CHOICE }
  }

  const error = usersMaxError(parsed.data.planKey, parsed.data.extraSeats)
  return error ? { ok: false, error } : { ok: true, choice: parsed.data }
}

async function retrieveSubscription(
  stripe: Stripe,
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    // `discounts` expandido: o downgrade agendado copia os descontos para as fases.
    return await stripe.subscriptions.retrieve(subscriptionId, { expand: ["discounts"] })
  } catch (error) {
    if (isStripeResourceMissing(error)) {
      return null
    }

    throw error
  }
}

/** Preços ativos (id e valor em centavos) do plano e, se pedido, do assento. */
async function resolveCatalogPrices(
  stripe: Stripe,
  planKey: PlanKey,
  interval: BillingInterval,
  withSeats: boolean
): Promise<{ plan: CatalogPrice; seat: CatalogPrice | null } | null> {
  const planLookupKey = priceLookupKey(planKey, interval)
  const seatKey = seatLookupKey(planKey, interval)
  const prices = await stripe.prices.list({
    lookup_keys: withSeats ? [planLookupKey, seatKey] : [planLookupKey],
    active: true,
    limit: 10,
  })
  const byLookupKey = new Map<string, CatalogPrice>()

  for (const price of prices.data) {
    if (price.lookup_key && typeof price.unit_amount === "number") {
      byLookupKey.set(price.lookup_key, { id: price.id, amount: price.unit_amount })
    }
  }

  const plan = byLookupKey.get(planLookupKey)
  const seat = byLookupKey.get(seatKey) ?? null

  if (!plan || (withSeats && !seat)) {
    console.error(`[billing] preço ativo não encontrado na Stripe para ${planLookupKey}`)
    return null
  }

  return { plan, seat }
}

/**
 * Customer da imobiliária: o já vinculado ou um novo (nome da imobiliária,
 * e-mail do dono, metadata.organization_id), gravado em seguida no banco. A
 * chave de idempotência evita customer duplicado se a gravação falhar e o dono
 * tentar de novo.
 */
async function ensureCustomer(
  stripe: Stripe,
  context: MembershipContext,
  existingCustomerId: string | null
): Promise<string> {
  if (existingCustomerId) {
    return existingCustomerId
  }

  const { membership, user } = context
  const organizationId = membership.organizationId
  const fingerprint = createHash("sha256")
    .update(`${membership.organization.name}\n${user.email ?? ""}`)
    .digest("hex")
    .slice(0, 16)

  const customer = await stripe.customers.create(
    {
      name: membership.organization.name,
      ...(user.email ? { email: user.email } : {}),
      preferred_locales: ["pt-BR"],
      metadata: { organization_id: organizationId },
    },
    { idempotencyKey: `crm-customer-${organizationId}-${fingerprint}` }
  )

  await syncBillingAccount(organizationId, {
    stripe_customer_id: customer.id,
    plan_key: null,
    status: null,
  })

  return customer.id
}

/** Relê a assinatura e grava o resumo; o webhook repete depois, sem problema. */
async function syncAfterChange(subscriptionId: string) {
  try {
    const result = await syncSubscriptionFromStripe(subscriptionId)

    if (result.outcome === "ignored") {
      console.error(`[billing] sincronização após a troca ignorada: ${result.reason}`)
    }
  } catch (error) {
    console.error(`[billing] sincronização após a troca falhou (${describeBillingError(error)})`)
  }
}

/** Solta a agenda (troca futura pendente). Agenda já encerrada é ignorada. */
async function releaseSchedule(stripe: Stripe, scheduleId: string) {
  try {
    await stripe.subscriptionSchedules.release(scheduleId)
  } catch (error) {
    if (isStripeError(error) && error.type === "StripeInvalidRequestError") {
      return
    }

    throw error
  }
}

/** Valor anual equivalente, para comparar ciclos diferentes. */
function annualized(amount: number, interval: BillingInterval) {
  return interval === "month" ? amount * 12 : amount
}

function currentAmount(composition: PlanComposition) {
  const planAmount = composition.plan.item.price.unit_amount ?? 0
  const seatsAmount = composition.seatItems.reduce(
    (total, item) => total + (item.price.unit_amount ?? 0) * (item.quantity ?? 0),
    0
  )

  return annualized(planAmount + seatsAmount, composition.plan.interval)
}

/** Itens da assinatura na troca imediata: plano substituído, assentos ajustados. */
function buildItemUpdates(
  composition: PlanComposition,
  prices: { plan: CatalogPrice; seat: CatalogPrice | null },
  extraSeats: number
): SubscriptionItemUpdate[] {
  const items: SubscriptionItemUpdate[] = [
    { id: composition.plan.item.id, price: prices.plan.id, quantity: 1 },
  ]
  const [seatItem, ...duplicatedSeatItems] = composition.seatItems

  if (extraSeats > 0 && prices.seat) {
    items.push(
      seatItem
        ? { id: seatItem.id, price: prices.seat.id, quantity: extraSeats }
        : { price: prices.seat.id, quantity: extraSeats }
    )
  } else if (seatItem) {
    items.push({ id: seatItem.id, deleted: true })
  }

  for (const item of duplicatedSeatItems) {
    items.push({ id: item.id, deleted: true })
  }

  return items
}

/**
 * Redução no fim do ciclo: agenda (Subscription Schedule) com a fase atual
 * intacta e uma fase seguinte com os novos itens, sem proporcional. Ao entrar
 * na nova fase a agenda é liberada e a assinatura segue normal.
 */
async function scheduleChangeAtPeriodEnd(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  choice: SubscriptionChoice,
  prices: { plan: CatalogPrice; seat: CatalogPrice | null },
  idempotencyKey: string
) {
  const existingScheduleId = idOf(subscription.schedule)
  const schedule = existingScheduleId
    ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
    : await stripe.subscriptionSchedules.create(
        { from_subscription: subscription.id },
        { idempotencyKey: `${idempotencyKey}-schedule` }
      )

  const now = Math.floor(Date.now() / 1000)
  const currentPhase =
    schedule.phases.find((phase) => phase.start_date <= now && now < phase.end_date) ??
    schedule.phases[0]

  if (!currentPhase) {
    throw new Error("Agenda da assinatura sem fase atual")
  }

  const nextItems = [{ price: prices.plan.id, quantity: 1 }]

  if (choice.extraSeats > 0 && prices.seat) {
    nextItems.push({ price: prices.seat.id, quantity: choice.extraSeats })
  }

  // Fases sem `discounts` ficam sem desconto: copia os atuais (inclusive o cupom
  // de indicação) nas duas. Na fase atual reaproveita os descontos; na seguinte, pelo cupom.
  const couponsByDiscount = couponIdsByDiscount(subscription)
  const currentDiscounts = phaseDiscountParams(currentPhase.discounts, couponsByDiscount, {
    preferCoupon: false,
  })
  const nextDiscounts = phaseDiscountParams(currentPhase.discounts, couponsByDiscount, {
    preferCoupon: true,
  })

  await stripe.subscriptionSchedules.update(
    schedule.id,
    {
      end_behavior: "release",
      proration_behavior: "none",
      phases: [
        {
          start_date: currentPhase.start_date,
          end_date: currentPhase.end_date,
          items: currentPhase.items.flatMap((item) => {
            const price = idOf(item.price)
            return price ? [{ price, quantity: item.quantity ?? undefined }] : []
          }),
          ...(currentDiscounts.length > 0 ? { discounts: currentDiscounts } : {}),
        },
        {
          items: nextItems,
          proration_behavior: "none",
          duration: { interval: choice.interval, interval_count: 1 },
          ...(nextDiscounts.length > 0 ? { discounts: nextDiscounts } : {}),
        },
      ],
    },
    { idempotencyKey: `${idempotencyKey}-phases` }
  )
}

/**
 * Sessão do Customer Portal (configuração padrão da conta). Portal sem
 * configuração vira mensagem amigável; atalho recusado abre a página inicial.
 */
async function createPortalUrl(
  stripe: Stripe,
  params: {
    customerId: string
    returnUrl: string
    flowData?: Stripe.BillingPortal.SessionCreateParams.FlowData
  }
): Promise<BillingActionResult> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
      locale: "pt-BR",
      ...(params.flowData ? { flow_data: params.flowData } : {}),
    })

    return { ok: true, url: session.url }
  } catch (error) {
    if (isPortalNotConfiguredError(error)) {
      console.error("[billing] Customer Portal sem configuração padrão no painel da Stripe")
      return { ok: false, error: PORTAL_NOT_CONFIGURED }
    }

    if (params.flowData && isStripeError(error) && error.type === "StripeInvalidRequestError") {
      console.error(
        `[billing] atalho do portal recusado (${describeBillingError(error)}); abrindo o portal`
      )
      return createPortalUrl(stripe, { customerId: params.customerId, returnUrl: params.returnUrl })
    }

    throw error
  }
}

/**
 * Cupom de indicação para o Checkout (desconto já na 1ª fatura). Falha não
 * impede a contratação: o webhook aplica o cupom na assinatura depois.
 */
async function findReferralCoupon(
  stripe: Stripe,
  organizationId: string,
  choice: { planKey: PlanKey; interval: BillingInterval }
): Promise<string | null> {
  try {
    return await referralCouponForCheckout(stripe, organizationId, choice)
  } catch (error) {
    console.error(
      `[billing] cupom de indicação indisponível no Checkout (${describeBillingError(error)})`
    )
    return null
  }
}

/** Primeira contratação pelo Checkout hospedado (quem já assina usa changeSubscription). */
export async function startCheckout(input: SubscriptionChoice): Promise<BillingActionResult> {
  const parsed = parseChoice(input)

  if (!parsed.ok) {
    return parsed
  }

  const owner = await requireOwner()

  if (!owner.ok) {
    return owner
  }

  // Conta suspensa pela plataforma: a Stripe não desbloqueia, então não cobra.
  const billing = await getBillingOverview(owner.context.membership.organizationId)

  if (billing?.platformBlocked) {
    return { ok: false, error: PLATFORM_BLOCKED }
  }

  const stripe = getStripe()

  if (!stripe) {
    return { ok: false, error: STRIPE_NOT_CONFIGURED }
  }

  const { planKey, interval, extraSeats } = parsed.choice
  const { membership } = owner.context
  const organizationId = membership.organizationId
  const settingsUrl = buildTenantUrl(membership.organization.slug, SUBSCRIPTION_SETTINGS_PATH)

  try {
    const account = await getBillingAccountIds(organizationId)

    if (!account) {
      return { ok: false, error: ACCOUNT_NOT_READY }
    }

    if (account.stripeSubscriptionId) {
      const current = await retrieveSubscription(stripe, account.stripeSubscriptionId)

      if (current && !TERMINAL_STATUSES.has(current.status)) {
        return { ok: false, error: ALREADY_SUBSCRIBED }
      }
    }

    const prices = await resolveCatalogPrices(stripe, planKey, interval, extraSeats > 0)

    if (!prices) {
      return { ok: false, error: PLAN_UNAVAILABLE }
    }

    const customerId = await ensureCustomer(stripe, owner.context, account.stripeCustomerId)
    const referralCoupon = await findReferralCoupon(stripe, organizationId, { planKey, interval })
    const lineItems: CheckoutLineItem[] = [{ price: prices.plan.id, quantity: 1 }]

    if (extraSeats > 0 && prices.seat) {
      lineItems.push({ price: prices.seat.id, quantity: extraSeats })
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: organizationId,
        line_items: lineItems,
        locale: "pt-BR",
        // Desconto por indicações já na 1ª fatura. A Stripe não aceita cupom e
        // campo de código promocional na mesma sessão.
        ...(referralCoupon
          ? { discounts: [{ coupon: referralCoupon }] }
          : { allow_promotion_codes: true }),
        billing_address_collection: "auto",
        tax_id_collection: { enabled: true },
        customer_update: { name: "auto", address: "auto" },
        metadata: { organization_id: organizationId },
        subscription_data: { metadata: { organization_id: organizationId } },
        success_url: `${settingsUrl}?checkout=sucesso`,
        cancel_url: `${settingsUrl}?checkout=cancelado`,
      },
      {
        idempotencyKey: `crm-checkout-${organizationId}-${planKey}-${interval}-${extraSeats}-${referralCoupon ?? "sem-cupom"}-${idempotencyWindow()}`,
      }
    )

    if (!session.url) {
      console.error("[billing] Checkout criado sem URL")
      return { ok: false, error: STRIPE_GENERIC_ERROR }
    }

    return { ok: true, url: session.url }
  } catch (error) {
    console.error(`[billing] início do Checkout falhou (${describeBillingError(error)})`)
    return { ok: false, error: translateBillingError(error) ?? STRIPE_GENERIC_ERROR }
  }
}

/**
 * Troca de plano, ciclo ou usuários adicionais dentro do app (o Portal da Stripe
 * não troca assinatura com plano + assentos nem com Boleto):
 * - aumento de valor (upgrade ou mais usuários): agora, cobrando o proporcional;
 * - redução (downgrade ou menos usuários): no fim do ciclo, por agenda;
 * - mesmo valor: agora, sem cobrança.
 * Nada é apagado; reduzir exige que os usuários atuais caibam no novo limite.
 */
export async function changeSubscription(
  input: SubscriptionChoice
): Promise<ChangeSubscriptionResult> {
  const parsed = parseChoice(input)

  if (!parsed.ok) {
    return parsed
  }

  const owner = await requireOwner()

  if (!owner.ok) {
    return owner
  }

  // Conta suspensa pela plataforma: a Stripe não desbloqueia, então não cobra.
  const billing = await getBillingOverview(owner.context.membership.organizationId)

  if (billing?.platformBlocked) {
    return { ok: false, error: PLATFORM_BLOCKED }
  }

  const stripe = getStripe()

  if (!stripe) {
    return { ok: false, error: STRIPE_NOT_CONFIGURED }
  }

  const choice = parsed.choice
  const organizationId = owner.context.membership.organizationId

  try {
    const account = await getBillingAccountIds(organizationId)
    const subscription = account?.stripeSubscriptionId
      ? await retrieveSubscription(stripe, account.stripeSubscriptionId)
      : null

    if (!subscription || TERMINAL_STATUSES.has(subscription.status)) {
      return { ok: false, error: NO_ACTIVE_SUBSCRIPTION }
    }

    if (!CHANGEABLE_STATUSES.has(subscription.status)) {
      return { ok: false, error: PAYMENT_PENDING }
    }

    const composition = describeSubscriptionItems(subscription)

    if (!composition.plan) {
      console.error("[billing] assinatura sem item de plano reconhecido")
      return { ok: false, error: CURRENT_PLAN_UNKNOWN }
    }

    const current = composition as PlanComposition
    const scheduleId = idOf(subscription.schedule)

    if (
      current.plan.key === choice.planKey &&
      current.plan.interval === choice.interval &&
      current.extraSeats === choice.extraSeats
    ) {
      if (!scheduleId) {
        return { ok: false, error: SAME_CHOICE }
      }

      // Voltar à configuração atual desfaz a redução agendada.
      await releaseSchedule(stripe, scheduleId)
      await syncAfterChange(subscription.id)
      return { ok: true, effective: "now" }
    }

    const nextUsers = computeLimits(choice.planKey, choice.extraSeats).users
    const currentUsers = computeLimits(current.plan.key, current.extraSeats).users

    if (nextUsers < currentUsers) {
      const overview = await getBillingOverview(organizationId)

      if (!overview) {
        return { ok: false, error: USAGE_UNKNOWN }
      }

      const used = overview.usage.users

      if (nextUsers < used) {
        const excess = used - nextUsers
        return {
          ok: false,
          error: `A nova configuração permite ${nextUsers} usuário(s), mas a imobiliária tem ${used} entre membros ativos e convites pendentes. Desative ou cancele ${excess} acesso(s) na gestão da equipe antes de reduzir.`,
        }
      }
    }

    const prices = await resolveCatalogPrices(
      stripe,
      choice.planKey,
      choice.interval,
      choice.extraSeats > 0
    )

    if (!prices) {
      return { ok: false, error: PLAN_UNAVAILABLE }
    }

    const previousTotal = currentAmount(current)
    const nextTotal = annualized(
      prices.plan.amount + (prices.seat?.amount ?? 0) * choice.extraSeats,
      choice.interval
    )
    const idempotencyKey = `crm-change-${organizationId}-${choice.planKey}-${choice.interval}-${choice.extraSeats}-${idempotencyWindow()}`

    if (nextTotal < previousTotal) {
      if (subscription.cancel_at_period_end || subscription.cancel_at !== null) {
        return { ok: false, error: CANCELLATION_SCHEDULED }
      }

      await scheduleChangeAtPeriodEnd(stripe, subscription, choice, prices, idempotencyKey)
      await syncAfterChange(subscription.id)
      return { ok: true, effective: "period_end" }
    }

    if (scheduleId) {
      await releaseSchedule(stripe, scheduleId)
    }

    const items = buildItemUpdates(current, prices, choice.extraSeats)
    const charges = nextTotal > previousTotal
    // Cobrança automática (cartão): os itens só mudam com o pagamento aprovado
    // (pending update). Boleto/fatura (send_invoice) não aceita esse modo: a
    // troca vale na hora e a fatura fica em aberto, como na renovação.
    const waitForPayment = charges && subscription.collection_method === "charge_automatically"

    await stripe.subscriptions.update(
      subscription.id,
      {
        items,
        proration_behavior: charges ? "always_invoice" : "none",
        ...(waitForPayment ? { payment_behavior: "pending_if_incomplete" as const } : {}),
      },
      { idempotencyKey }
    )

    await syncAfterChange(subscription.id)
    return { ok: true, effective: "now" }
  } catch (error) {
    console.error(`[billing] troca de assinatura falhou (${describeBillingError(error)})`)
    return { ok: false, error: translateBillingError(error) ?? STRIPE_GENERIC_ERROR }
  }
}

/**
 * Customer Portal: forma de pagamento, faturas, dados de cobrança e
 * cancelamento. Atalhos: payment_method_update e subscription_cancel.
 */
export async function openBillingPortal(input?: {
  flow?: BillingPortalFlow
}): Promise<BillingActionResult> {
  const parsed = portalSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: INVALID_PORTAL_FLOW }
  }

  const flow = parsed.data?.flow
  const owner = await requireOwner()

  if (!owner.ok) {
    return owner
  }

  const stripe = getStripe()

  if (!stripe) {
    return { ok: false, error: STRIPE_NOT_CONFIGURED }
  }

  const { membership } = owner.context
  const settingsUrl = buildTenantUrl(membership.organization.slug, SUBSCRIPTION_SETTINGS_PATH)
  const afterCompletion = { type: "redirect" as const, redirect: { return_url: settingsUrl } }

  try {
    const account = await getBillingAccountIds(membership.organizationId)

    if (!account?.stripeCustomerId) {
      return { ok: false, error: NO_CUSTOMER }
    }

    let flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined

    if (flow === "payment_method_update") {
      flowData = { type: flow, after_completion: afterCompletion }
    } else if (flow === "subscription_cancel") {
      if (!account.stripeSubscriptionId) {
        return { ok: false, error: NO_SUBSCRIPTION }
      }

      flowData = {
        type: flow,
        subscription_cancel: { subscription: account.stripeSubscriptionId },
        after_completion: afterCompletion,
      }
    }

    return await createPortalUrl(stripe, {
      customerId: account.stripeCustomerId,
      returnUrl: settingsUrl,
      flowData,
    })
  } catch (error) {
    console.error(`[billing] abertura do portal falhou (${describeBillingError(error)})`)
    return { ok: false, error: translateBillingError(error) ?? STRIPE_GENERIC_ERROR }
  }
}
