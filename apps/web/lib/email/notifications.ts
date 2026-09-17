import "server-only"

import { normalizeEmailAddress, isUuid } from "@workspace/core/email/sanitize"
import {
  aiQuotaNoticeEmail,
  authorizationExpiringEmail,
  captureRequestEmail,
  leadSlaNoticeEmail,
  newLeadEmail,
  referralNoticeEmail,
  subscriptionNoticeEmail,
  teamInvitationEmail,
  type AiQuotaNoticeKind,
  type AuthorizationExpiringItem,
  type LeadSlaNoticeKind,
  type ReferralNoticeKind,
  type RenderedEmail,
  type SubscriptionNoticeKind,
} from "@workspace/core/email/templates"

import { normalizeRecipient } from "@/lib/email/address"
import { deriveIdempotencyKey } from "@/lib/email/idempotency"
import { getEmailProvider } from "@/lib/email/provider"
import { loadLandingContext, loadOrganizationContext } from "@/lib/email/public-context"
import { getNotificationRecipients } from "@/lib/email/recipients"
import type { EmailAddress, EmailFailureReason } from "@/lib/email/types"
import { buildTenantOrigin } from "@/lib/tenant/urls"

/**
 * Notificações por e-mail do CRM. Feita para rodar depois da resposta, dentro de
 * `after()` (next/server): nunca lança, não bloqueia a action e registra só
 * contagens e motivos (nunca e-mail completo, corpo ou chave).
 *
 * @example Lead de landing page (lib/leads-publicos/actions.ts, depois do sucesso)
 * ```ts
 * after(() =>
 *   sendNotificationEmail("new_lead", {
 *     organizationSlug: slugs.org,
 *     eventId: payload.event_id,
 *     lead: { name: payload.name, source: "landing_page", landingPageSlug: slugs.page },
 *   })
 * )
 * ```
 */

export type NotificationKind =
  | "new_lead"
  | "lead_sla_notice"
  | "capture_request"
  | "team_invitation"
  | "subscription_notice"
  | "referral_notice"
  | "ai_quota_notice"
  | "authorization_expiring"

/** Evita a consulta às RPCs públicas quando quem chama já tem nome e cor. */
export type NotificationBrand = { name?: string | null; primaryColor?: string | null }

export type NewLeadNotification = {
  organizationSlug: string
  organizationId?: string | null
  /** leads.id, quando conhecido (o link abre o lead). */
  leadId?: string | null
  /**
   * event_id enviado a submit_landing_lead (que não devolve o id): o banco acha
   * o lead criado há até 15 min. Informe leadId ou eventId.
   */
  eventId?: string | null
  lead: {
    name: string
    source?: string | null
    /** Busca nome da página e do imóvel na landing page publicada. */
    landingPageSlug?: string | null
    propertyId?: string | null
    propertyLabel?: string | null
    interest?: string | null
    phone?: string | null
    receivedAt?: Date | string | null
  }
  brand?: NotificationBrand | null
}

/**
 * Aviso do SLA de primeiro contato (prazo acabando, lead redistribuído ou
 * perdido; e, para a gestão, prazo estourado sem outro corretor no rodízio),
 * reservado pelo banco na fila private.lead_notifications: o destinatário já
 * vem decidido de lá.
 */
export type LeadSlaNoticeNotification = {
  organizationSlug: string
  notice: LeadSlaNoticeKind
  /** Id do aviso na fila do banco: entra na chave de idempotência. */
  alertId: string
  to: EmailAddress
  lead: {
    id: string
    name: string
    source?: string | null
    interest?: string | null
    phone?: string | null
    receivedAt?: Date | string | null
  }
  slaMinutes: number
  minutesLeft?: number | null
  dueAt?: Date | string | null
  /** sla_breached: nome do corretor que continua com o lead (opcional). */
  assigneeName?: string | null
  brand?: NotificationBrand | null
}

export type CaptureRequestNotification = {
  organizationSlug: string
  organizationId?: string | null
  /** uuid devolvido por submit_capture_request. */
  captureRequestId: string
  request: {
    propertyType?: string | null
    purpose?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    receivedAt?: Date | string | null
  }
  brand?: NotificationBrand | null
}

export type TeamInvitationNotification = {
  organizationSlug: string
  invitationId: string
  to: string
  organizationName: string
  inviterName?: string | null
  role: string
  invitationUrl: string
  expiresAt: Date | string
  brand?: NotificationBrand | null
}

export type SubscriptionNoticeNotification = {
  organizationSlug: string
  organizationName: string
  notice: SubscriptionNoticeKind
  /** Responsáveis pela assinatura (definidos pelo módulo de Pagamentos). */
  to: readonly EmailAddress[]
  planName?: string | null
  date?: Date | string | null
  brand?: NotificationBrand | null
}

export type ReferralNoticeNotification = {
  /** Imobiliária indicadora (quem recebe o aviso). */
  organizationSlug: string
  organizationName: string
  notice: ReferralNoticeKind
  /** Imobiliária indicada: só entra na chave de idempotência. */
  referredOrganizationId: string
  /** Marca da transição (ex.: quando passou a contar ou fim da carência): idempotência por evento. */
  marker: string
  /** Nome já mascarado pelo banco (ex.: "Imobiliária J."). */
  referredName?: string | null
  /** Desconto acumulado depois da mudança (0 a 100). */
  discountPercent: number
  discountApplied: boolean
  /** Donos da imobiliária indicadora. */
  to: readonly EmailAddress[]
  brand?: NotificationBrand | null
}

/** Aviso de franquia de IA (80% e 100%), reservado pelo banco: 1 de cada por ciclo. */
export type AiQuotaNoticeNotification = {
  organizationSlug: string
  organizationName: string
  notice: AiQuotaNoticeKind
  /** Início do ciclo de IA: entra na chave de idempotência (1 aviso por ciclo). */
  periodStart: string
  /** Fim do ciclo, para o e-mail dizer quando a franquia vira. */
  periodEnd?: Date | string | null
  conversationsUsed: number
  conversationsLimit: number
  costCents: number
  capCents: number
  overageCapCents: number
  /** Responsáveis pela assinatura. */
  to: readonly EmailAddress[]
  brand?: NotificationBrand | null
}

/**
 * Autorização de venda/locação vencendo (cron diário): um e-mail por pessoa com
 * todos os imóveis que chegaram a um marco (30, 15, 7 ou 1 dia). A fila do banco
 * (private.authorization_alert_notifications) garante um aviso por marco.
 */
export type AuthorizationExpiringNotification = {
  organizationSlug: string
  /** Ids dos avisos da fila que este e-mail cobre: formam a chave de idempotência. */
  alertIds: readonly string[]
  to: EmailAddress
  /** Dono ou gerente (muda o motivo no rodapé). */
  isManager: boolean
  items: readonly AuthorizationExpiringItem[]
  brand?: NotificationBrand | null
}

export type NotificationParams = {
  new_lead: NewLeadNotification
  lead_sla_notice: LeadSlaNoticeNotification
  capture_request: CaptureRequestNotification
  team_invitation: TeamInvitationNotification
  subscription_notice: SubscriptionNoticeNotification
  referral_notice: ReferralNoticeNotification
  ai_quota_notice: AiQuotaNoticeNotification
  authorization_expiring: AuthorizationExpiringNotification
}

export type NotificationSummary = {
  kind: NotificationKind
  attempted: number
  sent: number
  failed: number
  /** Não tentados porque a configuração ou a cota diária falhou antes. */
  skipped: number
  reasons: Partial<Record<EmailFailureReason | "invalid_input", number>>
}

const MAX_RECIPIENTS = 20

type Outgoing = { to: EmailAddress; email: RenderedEmail; idempotencyKey: string }

function emptySummary(kind: NotificationKind): NotificationSummary {
  return { kind, attempted: 0, sent: 0, failed: 0, skipped: 0, reasons: {} }
}

function invalidInput(kind: NotificationKind): NotificationSummary {
  return { ...emptySummary(kind), failed: 1, reasons: { invalid_input: 1 } }
}

async function deliver(kind: NotificationKind, outgoing: Outgoing[]): Promise<NotificationSummary> {
  const summary = emptySummary(kind)
  const items = outgoing.slice(0, MAX_RECIPIENTS)

  if (items.length === 0) {
    return summary
  }

  const provider = getEmailProvider()

  for (const [index, item] of items.entries()) {
    summary.attempted += 1
    const result = await provider.send({
      to: item.to,
      subject: item.email.subject,
      html: item.email.html,
      text: item.email.text,
      tags: ["crm", kind],
      idempotencyKey: item.idempotencyKey,
    })

    if (result.ok) {
      summary.sent += 1
      continue
    }

    summary.failed += 1
    summary.reasons[result.reason] = (summary.reasons[result.reason] ?? 0) + 1

    // Sem configuração ou sem cota: os próximos falhariam do mesmo jeito.
    if (result.reason === "not_configured" || result.reason === "rate_limited") {
      summary.skipped = items.length - index - 1
      break
    }
  }

  return summary
}

async function notifyNewLead(params: NewLeadNotification): Promise<NotificationSummary> {
  const leadId = isUuid(params.leadId) ? params.leadId : null
  const subjectId = leadId ?? (isUuid(params.eventId) ? params.eventId : null)

  if (!subjectId) {
    return invalidInput("new_lead")
  }

  const origin = buildTenantOrigin(params.organizationSlug)
  const recipients = await getNotificationRecipients({
    kind: "new_lead",
    subjectId,
    organizationId: params.organizationId,
  })

  if (recipients.length === 0) {
    return emptySummary("new_lead")
  }

  const landing = params.lead.landingPageSlug
    ? await loadLandingContext(
        params.organizationSlug,
        params.lead.landingPageSlug,
        params.lead.propertyId
      )
    : null
  const brand =
    params.brand ??
    landing?.organization ??
    (await loadOrganizationContext(params.organizationSlug))
  const receivedAt = params.lead.receivedAt ?? new Date()

  return deliver(
    "new_lead",
    recipients.map((recipient) => ({
      to: { email: recipient.email, name: recipient.fullName },
      email: newLeadEmail({
        origin,
        brand,
        recipientName: recipient.fullName,
        lead: {
          id: leadId,
          name: params.lead.name,
          source: params.lead.source,
          landingPageName: landing?.pageName,
          propertyLabel: landing?.propertyLabel ?? params.lead.propertyLabel,
          interest: params.lead.interest,
          phone: params.lead.phone,
          receivedAt,
        },
      }),
      idempotencyKey: deriveIdempotencyKey("new_lead", subjectId, recipient.email),
    }))
  )
}

async function notifyLeadSlaNotice(
  params: LeadSlaNoticeNotification
): Promise<NotificationSummary> {
  const recipient = normalizeRecipient(params.to)

  if (!recipient || !isUuid(params.alertId)) {
    return invalidInput("lead_sla_notice")
  }

  const origin = buildTenantOrigin(params.organizationSlug)
  const brand = params.brand ?? (await loadOrganizationContext(params.organizationSlug))

  return deliver("lead_sla_notice", [
    {
      to: recipient,
      email: leadSlaNoticeEmail({
        origin,
        brand,
        recipientName: recipient.name,
        kind: params.notice,
        lead: {
          id: params.lead.id,
          name: params.lead.name,
          source: params.lead.source,
          interest: params.lead.interest,
          phone: params.lead.phone,
          receivedAt: params.lead.receivedAt,
        },
        slaMinutes: params.slaMinutes,
        minutesLeft: params.minutesLeft,
        dueAt: params.dueAt,
        assigneeName: params.assigneeName,
      }),
      // Uma vez por aviso da fila (o banco já reserva cada um).
      idempotencyKey: deriveIdempotencyKey("lead_sla_notice", params.alertId, recipient.email),
    },
  ])
}

async function notifyCaptureRequest(
  params: CaptureRequestNotification
): Promise<NotificationSummary> {
  if (!isUuid(params.captureRequestId)) {
    return invalidInput("capture_request")
  }

  const origin = buildTenantOrigin(params.organizationSlug)
  const recipients = await getNotificationRecipients({
    kind: "capture_request",
    subjectId: params.captureRequestId,
    organizationId: params.organizationId,
  })

  if (recipients.length === 0) {
    return emptySummary("capture_request")
  }

  const brand = params.brand ?? (await loadOrganizationContext(params.organizationSlug))
  const receivedAt = params.request.receivedAt ?? new Date()

  return deliver(
    "capture_request",
    recipients.map((recipient) => ({
      to: { email: recipient.email, name: recipient.fullName },
      email: captureRequestEmail({
        origin,
        brand,
        recipientName: recipient.fullName,
        request: { ...params.request, receivedAt },
      }),
      idempotencyKey: deriveIdempotencyKey(
        "capture_request",
        params.captureRequestId,
        recipient.email
      ),
    }))
  )
}

async function notifyTeamInvitation(
  params: TeamInvitationNotification
): Promise<NotificationSummary> {
  const to = normalizeEmailAddress(params.to)

  if (!to || !isUuid(params.invitationId)) {
    return invalidInput("team_invitation")
  }

  const origin = buildTenantOrigin(params.organizationSlug)
  const brand = params.brand ?? (await loadOrganizationContext(params.organizationSlug))
  const expiresAt =
    params.expiresAt instanceof Date ? params.expiresAt.toISOString() : params.expiresAt

  return deliver("team_invitation", [
    {
      to: { email: to },
      email: teamInvitationEmail({
        origin,
        brand,
        organizationName: params.organizationName,
        inviterName: params.inviterName,
        role: params.role,
        invitationUrl: params.invitationUrl,
        expiresAt: params.expiresAt,
      }),
      idempotencyKey: deriveIdempotencyKey("team_invitation", params.invitationId, to, expiresAt),
    },
  ])
}

async function notifySubscription(
  params: SubscriptionNoticeNotification
): Promise<NotificationSummary> {
  const origin = buildTenantOrigin(params.organizationSlug)
  const recipients = params.to.flatMap((address) => {
    const normalized = normalizeRecipient(address)
    return normalized ? [normalized] : []
  })

  if (recipients.length === 0) {
    return invalidInput("subscription_notice")
  }

  const date = params.date instanceof Date ? params.date.toISOString() : (params.date ?? null)

  return deliver(
    "subscription_notice",
    recipients.map((recipient) => ({
      to: recipient,
      email: subscriptionNoticeEmail({
        origin,
        // Aviso da plataforma: marca padrão, a menos que quem chama informe outra.
        brand: params.brand ?? null,
        recipientName: recipient.name,
        kind: params.notice,
        organizationName: params.organizationName,
        planName: params.planName,
        date: params.date,
      }),
      idempotencyKey: deriveIdempotencyKey(
        "subscription_notice",
        params.notice,
        params.organizationSlug,
        date,
        recipient.email
      ),
    }))
  )
}

async function notifyReferral(params: ReferralNoticeNotification): Promise<NotificationSummary> {
  const recipients = params.to.flatMap((address) => {
    const normalized = normalizeRecipient(address)
    return normalized ? [normalized] : []
  })

  if (recipients.length === 0 || !isUuid(params.referredOrganizationId)) {
    return invalidInput("referral_notice")
  }

  const origin = buildTenantOrigin(params.organizationSlug)

  return deliver(
    "referral_notice",
    recipients.map((recipient) => ({
      to: recipient,
      email: referralNoticeEmail({
        origin,
        // Aviso da plataforma: marca padrão, a menos que quem chama informe outra.
        brand: params.brand ?? null,
        recipientName: recipient.name,
        kind: params.notice,
        organizationName: params.organizationName,
        referredName: params.referredName,
        discountPercent: params.discountPercent,
        discountApplied: params.discountApplied,
      }),
      // Uma vez por transição (marker), não por percentual.
      idempotencyKey: deriveIdempotencyKey(
        "referral_notice",
        params.notice,
        params.referredOrganizationId,
        params.marker,
        recipient.email
      ),
    }))
  )
}

async function notifyAiQuota(params: AiQuotaNoticeNotification): Promise<NotificationSummary> {
  const recipients = params.to.flatMap((address) => {
    const normalized = normalizeRecipient(address)
    return normalized ? [normalized] : []
  })

  if (recipients.length === 0) {
    return invalidInput("ai_quota_notice")
  }

  const origin = buildTenantOrigin(params.organizationSlug)

  return deliver(
    "ai_quota_notice",
    recipients.map((recipient) => ({
      to: recipient,
      email: aiQuotaNoticeEmail({
        origin,
        // Aviso da plataforma: marca padrão, a menos que quem chama informe outra.
        brand: params.brand ?? null,
        recipientName: recipient.name,
        kind: params.notice,
        organizationName: params.organizationName,
        conversationsUsed: params.conversationsUsed,
        conversationsLimit: params.conversationsLimit,
        costCents: params.costCents,
        capCents: params.capCents,
        overageCapCents: params.overageCapCents,
        periodEnd: params.periodEnd,
      }),
      // Uma vez por ciclo e por nível (o banco já reserva o aviso).
      idempotencyKey: deriveIdempotencyKey(
        "ai_quota_notice",
        params.notice,
        params.organizationSlug,
        params.periodStart,
        recipient.email
      ),
    }))
  )
}

async function notifyAuthorizationExpiring(
  params: AuthorizationExpiringNotification
): Promise<NotificationSummary> {
  const recipient = normalizeRecipient(params.to)
  const alertIds = [...new Set(params.alertIds.filter((id) => isUuid(id)))].sort()

  if (!recipient || alertIds.length === 0 || params.items.length === 0) {
    return invalidInput("authorization_expiring")
  }

  const origin = buildTenantOrigin(params.organizationSlug)
  const brand = params.brand ?? (await loadOrganizationContext(params.organizationSlug))

  return deliver("authorization_expiring", [
    {
      to: recipient,
      email: authorizationExpiringEmail({
        origin,
        brand,
        recipientName: recipient.name,
        isManager: params.isManager,
        items: params.items,
      }),
      // Os mesmos avisos para a mesma pessoa não saem duas vezes (a fila do banco
      // já reserva cada um; isto cobre uma nova tentativa dentro de 30 min).
      idempotencyKey: deriveIdempotencyKey(
        "authorization_expiring",
        alertIds.join(","),
        recipient.email
      ),
    },
  ])
}

const HANDLERS: {
  [K in NotificationKind]: (params: NotificationParams[K]) => Promise<NotificationSummary>
} = {
  new_lead: notifyNewLead,
  lead_sla_notice: notifyLeadSlaNotice,
  capture_request: notifyCaptureRequest,
  team_invitation: notifyTeamInvitation,
  subscription_notice: notifySubscription,
  referral_notice: notifyReferral,
  ai_quota_notice: notifyAiQuota,
  authorization_expiring: notifyAuthorizationExpiring,
}

function logSummary(summary: NotificationSummary) {
  const reasons = Object.entries(summary.reasons)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ")

  const line = `[email] ${summary.kind}: ${summary.sent}/${summary.attempted} enviado(s)${
    summary.skipped ? `, ${summary.skipped} não tentado(s)` : ""
  }${reasons ? ` (${reasons})` : ""}`

  if (summary.failed > 0) {
    console.error(line)
  } else {
    console.info(line)
  }
}

/**
 * Monta e envia a notificação. Pensada para `after(() => sendNotificationEmail(...))`:
 * nunca lança e devolve só contagens.
 */
export async function sendNotificationEmail<K extends NotificationKind>(
  kind: K,
  params: NotificationParams[K]
): Promise<NotificationSummary> {
  if (!Object.prototype.hasOwnProperty.call(HANDLERS, kind)) {
    console.error("[email] tipo de notificação desconhecido")
    return invalidInput("new_lead")
  }

  try {
    const handler: (params: NotificationParams[K]) => Promise<NotificationSummary> = HANDLERS[kind]
    const summary = await handler(params)
    logSummary(summary)
    return summary
  } catch (cause) {
    // Só o tipo do erro: a mensagem pode conter dados do formulário.
    console.error(
      `[email] ${kind}: falha ao preparar a notificação (${cause instanceof Error ? cause.name : "erro"})`
    )
    return invalidInput(kind)
  }
}
