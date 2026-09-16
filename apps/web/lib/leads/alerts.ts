import "server-only"

import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

import { cleanText, isUuid, normalizeEmailAddress } from "@workspace/core/email/sanitize"

import { getSupabaseEnv } from "@/lib/supabase/env"

/**
 * Fila de avisos de lead do rodízio e do SLA de primeiro contato
 * (private.lead_notifications). Único ponto de chamada de
 * claim_lead_notifications e settle_lead_notifications: RPCs sem sessão, com a
 * chave publishable + NOTIFICATION_SERVER_KEY (segredo notification_server_key
 * do Vault). Nunca service_role.
 *
 * Nada aqui lança: em falha devolve lista vazia ou zeros e registra só o código
 * do erro. Os logs nunca levam e-mail, telefone ou nome — só códigos e contagens.
 */

/** Tipos enfileirados pelo banco (mesma lista do check de private.lead_notifications). */
export const LEAD_ALERT_KINDS = ["assigned", "sla_warning", "sla_reassigned", "sla_lost"] as const

export type LeadAlertKind = (typeof LEAD_ALERT_KINDS)[number]

export type LeadAlert = {
  /** Id do aviso na fila: entra na chave de idempotência e volta no settle. */
  id: string
  kind: LeadAlertKind
  organizationId: string
  organizationSlug: string
  leadId: string
  leadName: string
  leadSource: string | null
  leadInterest: string | null
  /** Cru: quem mascara é o template do e-mail. */
  leadPhone: string | null
  leadCreatedAt: string | null
  dueAt: string | null
  /** Prazo de primeiro contato da imobiliária; 0 quando o banco não informou. */
  slaMinutes: number
  recipientEmail: string
  recipientName: string | null
}

/** O banco recorta em 200 por chamada; o mesmo teto aqui evita pedir mais do que vem. */
const MAX_CLAIM = 200

const rowSchema = z.object({
  id: z.string(),
  kind: z.enum(LEAD_ALERT_KINDS),
  organization_id: z.string(),
  organization_slug: z.string(),
  lead_id: z.string(),
  lead_name: z.string(),
  lead_source: z.string().nullable(),
  lead_interest: z.string().nullable(),
  lead_phone: z.string().nullable(),
  lead_created_at: z.string().nullable(),
  due_at: z.string().nullable(),
  sla_minutes: z.number().nullable(),
  recipient_email: z.string(),
  recipient_name: z.string().nullable(),
})

const settledSchema = z.object({
  sent: z.number(),
  released: z.number(),
})

export type LeadAlertSettlement = { sent: number; released: number }

/** Cliente sem sessão: a autorização é a NOTIFICATION_SERVER_KEY dentro da RPC. */
function createNotificationClient(url: string, publishableKey: string) {
  // Sem o tipo Database de propósito: as RPCs entram em @workspace/database/types
  // na próxima regeneração; o retorno é validado com zod.
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function toAlert(row: z.infer<typeof rowSchema>): LeadAlert | null {
  if (!isUuid(row.id) || !isUuid(row.organization_id) || !isUuid(row.lead_id)) {
    return null
  }

  const recipientEmail = normalizeEmailAddress(row.recipient_email)
  const organizationSlug = cleanText(row.organization_slug, { maxLength: 63 })

  if (!recipientEmail || !organizationSlug) {
    return null
  }

  const slaMinutes =
    row.sla_minutes !== null && Number.isFinite(row.sla_minutes) ? Math.floor(row.sla_minutes) : 0

  return {
    id: row.id,
    kind: row.kind,
    organizationId: row.organization_id,
    organizationSlug,
    leadId: row.lead_id,
    leadName: cleanText(row.lead_name, { maxLength: 120 }) || "Novo contato",
    leadSource: cleanText(row.lead_source, { maxLength: 60 }) || null,
    leadInterest: cleanText(row.lead_interest, { maxLength: 60 }) || null,
    leadPhone: cleanText(row.lead_phone, { maxLength: 40 }) || null,
    leadCreatedAt: row.lead_created_at,
    dueAt: row.due_at,
    slaMinutes,
    recipientEmail,
    recipientName: cleanText(row.recipient_name, { maxLength: 120 }) || null,
  }
}

/**
 * Reserva os avisos pendentes (marca claimed_at e incrementa attempts). Todo id
 * devolvido precisa voltar em settleLeadAlerts, senão fica preso por 15 min.
 */
export async function claimLeadAlerts(limit: number): Promise<LeadAlert[]> {
  const serverKey = process.env.NOTIFICATION_SERVER_KEY?.trim()

  if (!serverKey) {
    console.error("NOTIFICATION_SERVER_KEY ausente")
    return []
  }

  const size = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), MAX_CLAIM) : 1
  const env = getSupabaseEnv()

  if (!env) {
    console.error("[leads/alerts] claim: Supabase não configurado")
    return []
  }

  try {
    const supabase = createNotificationClient(env.url, env.publishableKey)
    const { data, error } = await supabase.rpc("claim_lead_notifications", {
      p_server_key: serverKey,
      p_limit: size,
    })

    if (error) {
      console.error(
        `[leads/alerts] claim_lead_notifications falhou (código ${error.code || "desconhecido"})`
      )
      return []
    }

    if (!Array.isArray(data)) {
      console.error("[leads/alerts] claim_lead_notifications: resposta inesperada")
      return []
    }

    const alerts: LeadAlert[] = []
    let discarded = 0

    for (const row of data) {
      const parsed = rowSchema.safeParse(row)
      const alert = parsed.success ? toAlert(parsed.data) : null

      if (!alert) {
        discarded += 1
        continue
      }

      alerts.push(alert)
    }

    if (discarded > 0) {
      console.error(`[leads/alerts] claim: ${discarded} aviso(s) com dados inválidos descartado(s)`)
    }

    return alerts
  } catch (cause) {
    console.error(
      `[leads/alerts] claim_lead_notifications falhou (${cause instanceof Error ? cause.name : "erro"})`
    )
    return []
  }
}

/**
 * Confirma os enviados e devolve os que falharam para a fila (até 5 tentativas).
 * Chame sempre depois de tentar enviar, mesmo quando nada foi enviado.
 */
export async function settleLeadAlerts(
  sentIds: readonly string[],
  failedIds: readonly string[]
): Promise<LeadAlertSettlement> {
  const empty: LeadAlertSettlement = { sent: 0, released: 0 }
  const sent = [...new Set(sentIds.filter((id) => isUuid(id)))]
  const failed = [...new Set(failedIds.filter((id) => isUuid(id) && !sent.includes(id)))]

  if (sent.length === 0 && failed.length === 0) {
    return empty
  }

  const serverKey = process.env.NOTIFICATION_SERVER_KEY?.trim()

  if (!serverKey) {
    console.error("NOTIFICATION_SERVER_KEY ausente")
    return empty
  }

  const env = getSupabaseEnv()

  if (!env) {
    console.error("[leads/alerts] settle: Supabase não configurado")
    return empty
  }

  try {
    const supabase = createNotificationClient(env.url, env.publishableKey)
    const { data, error } = await supabase.rpc("settle_lead_notifications", {
      p_server_key: serverKey,
      p_sent: sent,
      p_failed: failed,
    })

    if (error) {
      console.error(
        `[leads/alerts] settle_lead_notifications falhou (código ${error.code || "desconhecido"})`
      )
      return empty
    }

    const parsed = settledSchema.safeParse(data)

    if (!parsed.success) {
      console.error("[leads/alerts] settle_lead_notifications: resposta inesperada")
      return empty
    }

    return { sent: parsed.data.sent, released: parsed.data.released }
  } catch (cause) {
    console.error(
      `[leads/alerts] settle_lead_notifications falhou (${cause instanceof Error ? cause.name : "erro"})`
    )
    return empty
  }
}
