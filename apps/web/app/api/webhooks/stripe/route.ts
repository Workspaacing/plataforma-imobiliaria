import type Stripe from "stripe"

import { describeBillingError } from "@/lib/billing/errors"
import { BillingRpcError } from "@/lib/billing/rpc"
import { getStripe, isTransientStripeError, readWebhookSecret } from "@/lib/billing/stripe"
import {
  parseOrganizationId,
  StripeNotConfiguredError,
  syncCustomerWithoutSubscription,
  syncSubscriptionFromStripe,
  type SyncResult,
} from "@/lib/billing/sync"

/**
 * Webhook da Stripe (pagamentos e assinatura). Público e sem sessão: a
 * autenticidade vem da assinatura `stripe-signature` sobre o corpo cru.
 * O payload do evento só aponta QUAL objeto mudou; o estado é relido na API
 * (lib/billing/sync.ts) e gravado com upsert idempotente.
 *
 * Respostas: 400 assinatura inválida; 500 falha transitória (a Stripe reenvia);
 * 200 nos demais casos, inclusive eventos ignorados. Logs sem dados pessoais.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HANDLED_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
])

/** Erros de validação do payload no banco: repetir não resolve. */
const PERMANENT_RPC_CODES = new Set(["22023", "22P02", "23514"])

function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) {
    return null
  }

  return typeof value === "string" ? value : value.id
}

async function handleEvent(event: Stripe.Event): Promise<SyncResult | null> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object

      if (session.mode !== "subscription") {
        return null
      }

      const hint = {
        organizationId:
          parseOrganizationId(session.client_reference_id) ??
          parseOrganizationId(session.metadata?.organization_id),
      }
      const subscriptionId = idOf(session.subscription)

      if (subscriptionId) {
        return syncSubscriptionFromStripe(subscriptionId, hint)
      }

      const customerId = idOf(session.customer)
      return customerId ? syncCustomerWithoutSubscription(customerId, hint) : null
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return syncSubscriptionFromStripe(event.data.object.id)
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subscriptionId = idOf(event.data.object.parent?.subscription_details?.subscription)
      return subscriptionId ? syncSubscriptionFromStripe(subscriptionId) : null
    }
    default:
      return null
  }
}

function isTransientFailure(error: unknown) {
  if (error instanceof StripeNotConfiguredError) {
    return true
  }

  if (error instanceof BillingRpcError) {
    return !PERMANENT_RPC_CODES.has(error.code ?? "")
  }

  return isTransientStripeError(error)
}

function describeResult(result: SyncResult | null) {
  if (!result) {
    return "sem assinatura a sincronizar"
  }

  if (result.outcome === "synced") {
    return `sincronizado (organização ${result.organizationId}, status ${result.subscriptionStatus ?? "sem assinatura"})`
  }

  return `ignorado: ${result.reason}${result.organizationId ? ` (organização ${result.organizationId})` : ""}`
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const webhookSecret = readWebhookSecret()

  if (!stripe || !webhookSecret) {
    console.error(
      "[billing/webhook] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET ausente ou inválida"
    )
    return reply(500, { error: "not_configured" })
  }

  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return reply(400, { error: "missing_signature" })
  }

  // Corpo cru: qualquer parse antes da verificação invalida a assinatura.
  const payload = await request.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret)
  } catch (error) {
    console.error(`[billing/webhook] assinatura inválida (${describeBillingError(error)})`)
    return reply(400, { error: "invalid_signature" })
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    return reply(200, { received: true })
  }

  try {
    const result = await handleEvent(event)
    console.info(`[billing/webhook] ${event.id} ${event.type}: ${describeResult(result)}`)
    return reply(200, { received: true })
  } catch (error) {
    const transient = isTransientFailure(error)

    console.error(
      `[billing/webhook] ${event.id} ${event.type}: falha ${transient ? "transitória" : "permanente"} (${describeBillingError(error)})`
    )

    return transient ? reply(500, { error: "retry" }) : reply(200, { received: true })
  }
}
