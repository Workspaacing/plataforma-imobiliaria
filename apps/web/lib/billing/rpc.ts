import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { BillingInterval, BillingPlanKey } from "@workspace/core/billing"
import type { Database } from "@workspace/database/types"

import { getSupabaseEnv } from "@/lib/supabase/env"
import { createClient as createSessionClient } from "@/lib/supabase/server"

/**
 * Único ponto de chamada das RPCs de billing do Supabase.
 *
 * - Sem sessão, com a chave publishable + BILLING_SERVER_KEY (segredo
 *   `billing_server_key` do Vault): get_billing_account_ids,
 *   sync_billing_account e list_billing_reminders. Nunca service_role.
 * - Com sessão (RLS): get_billing_overview.
 *
 * As respostas são validadas antes de sair deste arquivo.
 */

/** Tipos de aviso aceitos por list_billing_reminders (combinados com o banco). */
export const BILLING_REMINDER_KINDS = [
  "trial_ending_3d",
  "trial_ending_1d",
  "past_due",
  "read_only_today",
] as const

export type BillingReminderKind = (typeof BILLING_REMINDER_KINDS)[number]

export type BillingAccountIds = {
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  status: string | null
}

/**
 * Payload de sync_billing_account. `stripe_customer_id` é obrigatório; chave
 * ausente ou null mantém o valor atual (usado para só vincular o customer).
 * `trial_ends_at` é recusado pelo banco: quem define é ele.
 */
export type BillingSyncPayload = {
  stripe_customer_id: string
  stripe_subscription_id?: string | null
  plan_key: BillingPlanKey | null
  billing_interval?: BillingInterval | null
  status: string | null
  seats?: number
  addon_keys?: string[]
  limits?: Record<string, number>
  features?: string[]
  current_period_end?: string | null
  cancel_at_period_end?: boolean
}

export type BillingReminderRow = {
  organizationId: string
  organizationSlug: string
  organizationName: string
  ownerEmails: string[]
  /** Fim do período que determina o estado (fim do teste, da carência ou início do modo leitura). */
  noticeDate: string | null
}

/**
 * Falha numa RPC de billing. Guarda só o código do Postgres/PostgREST e, quando
 * houver, o código estável levantado pelo banco (ex.: billing_customer_divergente);
 * nunca o texto livre, que pode conter dados.
 */
export class BillingRpcError extends Error {
  readonly code: string | null
  readonly reason: string | null

  constructor(operation: string, code: string | null, reason: string | null) {
    super(`${operation} falhou (${code ?? "sem código"}${reason ? `: ${reason}` : ""})`)
    this.name = "BillingRpcError"
    this.code = code
    this.reason = reason
  }
}

const STABLE_REASON_PATTERN = /\b(billing_[a-z0-9_]+)\b/

function toRpcError(operation: string, error: { code?: string | null; message?: string | null }) {
  const reason = STABLE_REASON_PATTERN.exec(error.message ?? "")?.[1] ?? null
  return new BillingRpcError(operation, error.code || null, reason)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

let warnedMissingServerKey = false

/** Lê BILLING_SERVER_KEY; se ausente, avisa uma vez só com o nome da variável. */
function readBillingServerKey(): string | null {
  const value = process.env.BILLING_SERVER_KEY?.trim()

  if (!value) {
    if (!warnedMissingServerKey) {
      warnedMissingServerKey = true
      console.warn(
        "[billing] BILLING_SERVER_KEY ausente: faturas e sincronização desativadas (veja .env.example)"
      )
    }

    return null
  }

  return value
}

function requireServerKeyClient(operation: string) {
  const env = getSupabaseEnv()
  const serverKey = readBillingServerKey()

  if (!env || !serverKey) {
    throw new BillingRpcError(operation, "not_configured", null)
  }

  const supabase = createClient<Database>(env.url, env.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return { supabase, serverKey }
}

/** IDs da Stripe vinculados à imobiliária; null se a imobiliária não existir. */
export async function getBillingAccountIds(
  organizationId: string
): Promise<BillingAccountIds | null> {
  const operation = "get_billing_account_ids"
  const { supabase, serverKey } = requireServerKeyClient(operation)
  const { data, error } = await supabase.rpc(operation, {
    p_server_key: serverKey,
    p_organization_id: organizationId,
  })

  if (error) {
    // Imobiliária inexistente: sem conta de billing (não é falha transitória).
    if (error.code === "P0002") {
      return null
    }

    throw toRpcError(operation, error)
  }

  const row: unknown = Array.isArray(data) ? data[0] : data

  if (!isRecord(row)) {
    return null
  }

  return {
    stripeCustomerId: readString(row.stripe_customer_id),
    stripeSubscriptionId: readString(row.stripe_subscription_id),
    status: readString(row.status),
  }
}

/** Upsert idempotente do resumo de billing da imobiliária. */
export async function syncBillingAccount(
  organizationId: string,
  payload: BillingSyncPayload
): Promise<void> {
  const operation = "sync_billing_account"
  const { supabase, serverKey } = requireServerKeyClient(operation)
  const { error } = await supabase.rpc(operation, {
    p_server_key: serverKey,
    p_organization_id: organizationId,
    p_payload: payload,
  })

  if (error) {
    throw toRpcError(operation, error)
  }
}

/** Imobiliárias que devem receber o aviso do tipo informado hoje. */
export async function listBillingReminders(
  kind: BillingReminderKind
): Promise<BillingReminderRow[]> {
  const operation = "list_billing_reminders"
  const { supabase, serverKey } = requireServerKeyClient(operation)
  const { data, error } = await supabase.rpc(operation, {
    p_server_key: serverKey,
    p_kind: kind,
  })

  if (error) {
    throw toRpcError(operation, error)
  }

  const rows: unknown[] = Array.isArray(data) ? data : []
  const reminders: BillingReminderRow[] = []

  for (const row of rows) {
    if (!isRecord(row)) {
      continue
    }

    const organizationId = readString(row.organization_id)
    const organizationSlug = readString(row.organization_slug)

    if (!organizationId || !organizationSlug) {
      continue
    }

    const ownerEmails = Array.isArray(row.owner_emails)
      ? [...new Set(row.owner_emails.map(readString).filter((email) => email !== null))]
      : []

    reminders.push({
      organizationId,
      organizationSlug,
      organizationName: readString(row.organization_name) ?? "sua imobiliária",
      ownerEmails,
      noticeDate: readString(row.notice_date),
    })
  }

  return reminders
}

/** Resposta crua de get_billing_overview (validada em queries.ts). Usa a sessão. */
export async function fetchBillingOverview(organizationId: string): Promise<unknown> {
  const operation = "get_billing_overview"
  const supabase = await createSessionClient()
  const { data, error } = await supabase.rpc(operation, { p_organization_id: organizationId })

  if (error) {
    throw toRpcError(operation, error)
  }

  return data
}
