// Modelos de e-mail transacional do CRM (pt-BR). Funções puras que devolvem
// { subject, html, text }. Todo dado vem de fora (formulário público, banco) e é
// tratado como não confiável: limpo e escapado em layout.ts; links só https (ou
// http em localhost) e caminhos relativos presos à origem recebida.

import { formatBRL } from "../billing/format"
import { REFERRAL_GRACE_DAYS } from "../billing/referrals"
import { APP_ROLE_LABELS, LISTING_PURPOSE_LABELS, PROPERTY_TYPE_LABELS } from "../properties/enums"
import { renderEmail, resolveBrand, type EmailBrand, type RenderedEmail } from "./layout"
import {
  cleanText,
  formatEmailDate,
  formatEmailDateTime,
  isUuid,
  maskPhoneNumber,
  normalizeEmailOrigin,
  resolveEmailLink,
} from "./sanitize"

export type { EmailBrand, RenderedEmail } from "./layout"

/** Origem ou link inválido: o e-mail não deve ser enviado. */
export class EmailTemplateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmailTemplateError"
  }
}

export const LEAD_SOURCE_EMAIL_LABELS = {
  landing_page: "Landing page",
  portal: "Portal",
  website: "Site",
  social: "Redes sociais",
  referral: "Indicação",
  manual: "Cadastro manual",
  other: "Outro",
} as const

export const LEAD_INTEREST_EMAIL_LABELS = {
  buy: "Comprar",
  rent: "Alugar",
  invest: "Investir",
  sell: "Vender",
  info: "Informações",
} as const

function labelFrom(labels: Readonly<Record<string, string>>, value: unknown): string | null {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(labels, value)
    ? (labels[value] ?? null)
    : null
}

function requireOrigin(origin: unknown) {
  const normalized = normalizeEmailOrigin(origin)

  if (!normalized) {
    throw new EmailTemplateError("Origem inválida para os links do e-mail.")
  }

  return normalized
}

function requireLink(href: unknown, origin: string) {
  const url = resolveEmailLink(href, origin)

  if (!url) {
    throw new EmailTemplateError("Link inválido para o e-mail.")
  }

  return url
}

function greetingFor(name: unknown) {
  const firstName = cleanText(name, { maxLength: 40 }).split(" ")[0]
  return firstName ? `Olá, ${firstName}!` : "Olá!"
}

// (a) Novo lead ------------------------------------------------------------------

export type NewLeadEmailParams = {
  /** Origem da imobiliária (subdomínio ou host único), ex.: https://imob.seucrm.com.br */
  origin: string
  brand?: EmailBrand | null
  recipientName?: string | null
  lead: {
    /** leads.id; sem ele o link abre o funil (/leads), onde o lead novo fica no topo. */
    id?: string | null
    name: string
    source?: string | null
    landingPageName?: string | null
    /** Ex.: "IMV-000123 - Apartamento 2 quartos no Centro" */
    propertyLabel?: string | null
    interest?: string | null
    /** Só os 4 últimos dígitos aparecem no e-mail. */
    phone?: string | null
    receivedAt?: Date | string | null
  }
}

export function newLeadEmail(params: NewLeadEmailParams): RenderedEmail {
  const origin = requireOrigin(params.origin)
  const brand = resolveBrand(params.brand)
  const lead = params.lead
  const leadId = isUuid(lead.id) ? lead.id.toLowerCase() : null
  const url = requireLink(leadId ? `/leads/${leadId}` : "/leads", origin)
  const name = cleanText(lead.name, { maxLength: 120 }) || "Novo contato"
  const source = labelFrom(LEAD_SOURCE_EMAIL_LABELS, lead.source)
  const landingPage = cleanText(lead.landingPageName, { maxLength: 120 })
  const property = cleanText(lead.propertyLabel, { maxLength: 160 })
  const origem = landingPage
    ? ` pela landing page “${landingPage}”`
    : source
      ? ` (origem: ${source})`
      : ""

  return renderEmail(params.brand, {
    subject: `Novo lead: ${cleanText(name, { maxLength: 60 })} — responda agora`,
    preheader:
      "Quem responde primeiro tem mais chance de atender o cliente. Entre em contato agora.",
    heading: "Você recebeu um novo lead",
    greeting: greetingFor(params.recipientName),
    paragraphs: [
      `${name} acabou de pedir contato${origem}${property ? `, com interesse em ${property}` : ""}.`,
    ],
    highlight:
      "Responda nos próximos minutos. Lead sem resposta esfria rápido e costuma procurar outra imobiliária.",
    details: [
      { label: "Nome", value: name },
      { label: "Origem", value: source },
      { label: "Landing page", value: landingPage },
      { label: "Imóvel de interesse", value: property },
      { label: "Interesse", value: labelFrom(LEAD_INTEREST_EMAIL_LABELS, lead.interest) },
      { label: "Telefone", value: maskPhoneNumber(lead.phone) },
      { label: "Recebido em", value: formatEmailDateTime(lead.receivedAt) },
    ],
    action: { label: "Abrir o lead no CRM", url },
    closing: [
      "O telefone aparece parcialmente oculto neste e-mail. Contato completo e histórico ficam no CRM.",
    ],
    footer: `Você recebeu este e-mail porque é responsável por este lead ou faz a gestão da equipe de ${brand.name} no CRM.`,
  })
}

// (b) Nova solicitação de captação ------------------------------------------------

export type CaptureRequestEmailParams = {
  origin: string
  brand?: EmailBrand | null
  recipientName?: string | null
  request: {
    propertyType?: string | null
    purpose?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    receivedAt?: Date | string | null
  }
}

export function captureRequestEmail(params: CaptureRequestEmailParams): RenderedEmail {
  const origin = requireOrigin(params.origin)
  const brand = resolveBrand(params.brand)
  const request = params.request
  const url = requireLink("/captacao", origin)
  const type = labelFrom(PROPERTY_TYPE_LABELS, request.propertyType)
  const neighborhood = cleanText(request.neighborhood, { maxLength: 80 })
  const city = cleanText(request.city, { maxLength: 80 })
  const stateRaw = cleanText(request.state, { maxLength: 2 }).toUpperCase()
  const state = /^[A-Z]{2}$/.test(stateRaw) ? stateRaw : ""
  const cityState = city && state ? `${city}/${state}` : city || state
  const location = [neighborhood, cityState].filter(Boolean).join(", ")

  return renderEmail(params.brand, {
    subject: `Nova solicitação de captação: ${type ?? "imóvel"}${location ? ` em ${location}` : ""}`,
    preheader: "Um proprietário quer anunciar com a sua imobiliária. Retorne enquanto ele decide.",
    heading: "Nova solicitação de captação",
    greeting: greetingFor(params.recipientName),
    paragraphs: [
      "Um proprietário pediu, pelo formulário de captação, para anunciar um imóvel com a sua imobiliária.",
    ],
    highlight: "Retorne o contato enquanto o proprietário ainda está escolhendo com quem anunciar.",
    details: [
      { label: "Tipo de imóvel", value: type },
      { label: "Finalidade", value: labelFrom(LISTING_PURPOSE_LABELS, request.purpose) },
      { label: "Bairro", value: neighborhood },
      { label: "Cidade", value: cityState },
      { label: "Recebida em", value: formatEmailDateTime(request.receivedAt) },
    ],
    action: { label: "Ver solicitações de captação", url },
    closing: ["Nome e contato do proprietário ficam só no CRM."],
    footer: `Você recebeu este e-mail porque participa da captação de imóveis (dono, gerente ou captador) da equipe de ${brand.name} no CRM.`,
  })
}

// (c) Convite para a equipe -------------------------------------------------------

export type TeamInvitationEmailParams = {
  origin: string
  brand?: EmailBrand | null
  organizationName: string
  inviterName?: string | null
  role: string
  /** Link do convite (absoluto https, ou caminho relativo à origem). */
  invitationUrl: string
  expiresAt: Date | string
}

export function teamInvitationEmail(params: TeamInvitationEmailParams): RenderedEmail {
  const origin = requireOrigin(params.origin)
  const url = requireLink(params.invitationUrl, origin)
  const organization = cleanText(params.organizationName, { maxLength: 80 }) || "sua imobiliária"
  const inviter = cleanText(params.inviterName, { maxLength: 60 })
  const role = labelFrom(APP_ROLE_LABELS, params.role)
  const validUntil = formatEmailDateTime(params.expiresAt)
  const brand = { name: organization, primaryColor: params.brand?.primaryColor ?? null }

  return renderEmail(brand, {
    subject: inviter
      ? `${inviter} convidou você para o CRM de ${organization}`
      : `Convite para a equipe de ${organization} no CRM`,
    preheader: validUntil
      ? `Aceite o convite até ${validUntil}.`
      : "Aceite o convite para entrar na equipe.",
    heading: `Convite para a equipe de ${organization}`,
    greeting: "Olá!",
    paragraphs: [
      `${inviter || "A equipe"} convidou você para entrar no CRM de ${organization}${role ? ` com o papel ${role}` : ""}.`,
    ],
    details: [
      { label: "Imobiliária", value: organization },
      { label: "Papel", value: role },
      { label: "Convidado por", value: inviter },
      { label: "Válido até", value: validUntil },
    ],
    action: { label: "Aceitar convite", url },
    closing: [
      "Para aceitar, entre ou crie sua conta com este mesmo e-mail e confirme o endereço. O link é pessoal: não o compartilhe.",
    ],
    footer: `Você recebeu este e-mail porque ${inviter || "alguém da equipe"} convidou este endereço para o CRM de ${organization}. Se não esperava o convite, ignore a mensagem: nenhum acesso é liberado sem a sua confirmação.`,
  })
}

// (d) Aviso de assinatura ---------------------------------------------------------

export type SubscriptionNoticeKind = "trial_ending" | "payment_failed" | "canceled" | "read_only"

export const SUBSCRIPTION_NOTICE_KINDS: readonly SubscriptionNoticeKind[] = [
  "trial_ending",
  "payment_failed",
  "canceled",
  "read_only",
]

export type SubscriptionNoticeEmailParams = {
  origin: string
  brand?: EmailBrand | null
  recipientName?: string | null
  kind: SubscriptionNoticeKind
  organizationName: string
  planName?: string | null
  /**
   * trial_ending: fim do teste; payment_failed: prazo para regularizar;
   * canceled: acesso disponível até; read_only: início do modo somente leitura.
   */
  date?: Date | string | null
}

export function subscriptionNoticeEmail(params: SubscriptionNoticeEmailParams): RenderedEmail {
  const origin = requireOrigin(params.origin)
  const url = requireLink("/configuracoes/assinatura", origin)
  const organization = cleanText(params.organizationName, { maxLength: 80 }) || "sua imobiliária"
  const plan = cleanText(params.planName, { maxLength: 60 })
  const date = formatEmailDate(params.date)
  const footer = `Você recebeu este e-mail porque é responsável pela assinatura de ${organization} no CRM.`
  const common = {
    greeting: greetingFor(params.recipientName),
    footer,
  }

  switch (params.kind) {
    case "trial_ending":
      return renderEmail(params.brand, {
        ...common,
        subject: date
          ? `O teste gratuito de ${organization} termina em ${date}`
          : `O teste gratuito de ${organization} está acabando`,
        preheader: "Escolha um plano para continuar usando o CRM sem interrupção.",
        heading: "Seu teste gratuito está acabando",
        paragraphs: [
          `O período de teste do CRM para ${organization}${date ? ` termina em ${date}` : " está chegando ao fim"}.`,
          "Para continuar sem interrupção, escolha um plano e cadastre a forma de pagamento.",
        ],
        details: [
          { label: "Imobiliária", value: organization },
          { label: "Plano", value: plan },
          { label: "Fim do teste", value: date },
        ],
        action: { label: "Escolher um plano", url },
      })
    case "payment_failed":
      return renderEmail(params.brand, {
        ...common,
        subject: `Não conseguimos cobrar a assinatura de ${organization}`,
        preheader: "Atualize a forma de pagamento para evitar a suspensão do acesso.",
        heading: "Pagamento não aprovado",
        paragraphs: [
          `Não conseguimos processar o último pagamento da assinatura de ${organization}.`,
          "Atualize a forma de pagamento para evitar a suspensão do acesso da equipe.",
        ],
        highlight: date ? `Regularize até ${date}.` : null,
        details: [
          { label: "Imobiliária", value: organization },
          { label: "Plano", value: plan },
          { label: "Prazo", value: date },
        ],
        action: { label: "Atualizar pagamento", url },
      })
    case "canceled":
      return renderEmail(params.brand, {
        ...common,
        subject: `A assinatura de ${organization} foi cancelada`,
        preheader: "Você pode reativar a assinatura na página de assinatura do CRM.",
        heading: "Assinatura cancelada",
        paragraphs: [
          `A assinatura do CRM para ${organization} foi cancelada${date ? `. O acesso fica disponível até ${date}` : ""}.`,
          "Para voltar a usar o CRM, reative a assinatura quando quiser.",
        ],
        details: [
          { label: "Imobiliária", value: organization },
          { label: "Plano", value: plan },
          { label: "Acesso até", value: date },
        ],
        action: { label: "Ver assinatura", url },
      })
    case "read_only":
      return renderEmail(params.brand, {
        ...common,
        subject: "Sua conta está em modo somente leitura",
        preheader: "Nenhum dado foi apagado. Regularize a assinatura para voltar a criar e editar.",
        heading: "Conta em modo somente leitura",
        paragraphs: [
          `A conta de ${organization} no CRM está em modo somente leitura${date ? ` desde ${date}` : ""}.`,
          "Você ainda pode ver e exportar tudo, e as landing pages e os formulários continuam recebendo leads.",
          "Não é possível criar nem editar registros até regularizar a assinatura.",
        ],
        highlight: "Nenhum dado foi apagado.",
        details: [
          { label: "Imobiliária", value: organization },
          { label: "Plano", value: plan },
          { label: "Somente leitura desde", value: date },
        ],
        action: { label: "Regularizar assinatura", url },
      })
    default:
      throw new EmailTemplateError("Tipo de aviso de assinatura inválido.")
  }
}

// (e) Indique e ganhe --------------------------------------------------------------

export type ReferralNoticeKind = "confirmed" | "lost"

export const REFERRAL_NOTICE_KINDS: readonly ReferralNoticeKind[] = ["confirmed", "lost"]

export type ReferralNoticeEmailParams = {
  origin: string
  brand?: EmailBrand | null
  recipientName?: string | null
  kind: ReferralNoticeKind
  organizationName: string
  /** Nome já mascarado da imobiliária indicada (ex.: "Imobiliária J."). */
  referredName?: string | null
  /** Desconto acumulado depois da mudança (0 a 100). */
  discountPercent: number
  /** A assinatura da indicadora está ativa (senão o desconto fica "a aplicar"). */
  discountApplied: boolean
}

function percentLabel(value: unknown) {
  const percent =
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(100, Math.max(0, Math.floor(value)))
      : 0
  return `${percent}%`
}

export function referralNoticeEmail(params: ReferralNoticeEmailParams): RenderedEmail {
  const origin = requireOrigin(params.origin)
  const url = requireLink("/configuracoes/indicacoes", origin)
  const organization = cleanText(params.organizationName, { maxLength: 80 }) || "sua imobiliária"
  const referred = cleanText(params.referredName, { maxLength: 60 }) || "Uma imobiliária indicada"
  const discount = percentLabel(params.discountPercent)
  const discountLine = params.discountApplied
    ? `Seu desconto por indicações agora é de ${discount} na mensalidade do plano.`
    : `Seu desconto acumulado agora é de ${discount}; ele passa a valer quando a assinatura de ${organization} estiver ativa.`
  const common = {
    greeting: greetingFor(params.recipientName),
    details: [
      { label: "Imobiliária indicada", value: referred },
      { label: "Desconto acumulado", value: discount },
      { label: "Situação do desconto", value: params.discountApplied ? "Aplicado" : "A aplicar" },
    ],
    action: { label: "Ver minhas indicações", url },
    footer: `Você recebeu este e-mail porque é responsável pela assinatura de ${organization} no CRM e participa do programa Indique e ganhe.`,
  }

  switch (params.kind) {
    case "confirmed":
      return renderEmail(params.brand, {
        ...common,
        subject: `Indicação confirmada: seu desconto agora é de ${discount}`,
        preheader: `Uma imobiliária que você indicou completou ${REFERRAL_GRACE_DAYS} dias de assinatura paga.`,
        heading: "Indicação confirmada",
        paragraphs: [
          `${referred} completou ${REFERRAL_GRACE_DAYS} dias de assinatura paga e passou a contar como indicação ativa.`,
          discountLine,
        ],
        highlight: "Cada indicação ativa soma desconto até a mensalidade sair de graça.",
      })
    case "lost":
      return renderEmail(params.brand, {
        ...common,
        subject: `Uma indicação deixou de contar: seu desconto agora é de ${discount}`,
        preheader: "Uma imobiliária que você indicou não está mais com a assinatura ativa.",
        heading: "Uma indicação deixou de contar",
        paragraphs: [
          `${referred} não está mais com a assinatura ativa, então deixou de contar no seu desconto.`,
          discountLine,
          "Se a assinatura dela voltar a ficar ativa, a indicação volta a contar.",
        ],
      })
    default:
      throw new EmailTemplateError("Tipo de aviso de indicação inválido.")
  }
}

// (f) Franquia de IA ---------------------------------------------------------------

export type AiQuotaNoticeKind = "ai_quota_80" | "ai_quota_100"

export const AI_QUOTA_NOTICE_KINDS: readonly AiQuotaNoticeKind[] = ["ai_quota_80", "ai_quota_100"]

export type AiQuotaNoticeEmailParams = {
  origin: string
  brand?: EmailBrand | null
  recipientName?: string | null
  kind: AiQuotaNoticeKind
  organizationName: string
  /** Unidades consumidas e franquia do ciclo (-1 = ilimitada). */
  conversationsUsed: number
  conversationsLimit: number
  /** Custo do ciclo e teto efetivo (plano + excedente), em centavos. */
  costCents: number
  capCents: number
  /** Teto de excedente ligado pela imobiliária, em centavos (0 = desligado). */
  overageCapCents: number
  /** Quando a franquia vira (fim do ciclo de IA). */
  periodEnd?: Date | string | null
}

function safeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

export function aiQuotaNoticeEmail(params: AiQuotaNoticeEmailParams): RenderedEmail {
  const origin = requireOrigin(params.origin)
  const url = requireLink("/configuracoes/assinatura", origin)
  const organization = cleanText(params.organizationName, { maxLength: 80 }) || "sua imobiliária"
  const used = safeCount(params.conversationsUsed)
  const limit = params.conversationsLimit
  const usage = limit > 0 ? `${used} de ${limit}` : String(used)
  const renewal = formatEmailDate(params.periodEnd)
  const overageOn = safeCount(params.overageCapCents) > 0
  const common = {
    greeting: greetingFor(params.recipientName),
    details: [
      { label: "Imobiliária", value: organization },
      { label: "Conversas de IA no ciclo", value: usage },
      {
        label: "Custo de IA no ciclo",
        value: `${formatBRL(safeCount(params.costCents))} de ${formatBRL(safeCount(params.capCents))}`,
      },
      { label: "A franquia vira em", value: renewal },
      {
        label: "Excedente",
        value: overageOn
          ? `Liberado até ${formatBRL(safeCount(params.overageCapCents))} por ciclo`
          : "Desligado",
      },
    ],
    action: { label: "Ver uso de IA", url },
    footer: `Você recebeu este e-mail porque é responsável pela assinatura de ${organization} no CRM.`,
  }

  switch (params.kind) {
    case "ai_quota_80":
      return renderEmail(params.brand, {
        ...common,
        subject: `A franquia de IA de ${organization} chegou a 80%`,
        preheader: "Ainda dá tempo de ajustar o teto de excedente antes de a IA parar.",
        heading: "Sua franquia de IA está em 80%",
        paragraphs: [
          `A imobiliária ${organization} já usou 80% da franquia de IA deste ciclo (${usage}).`,
          overageOn
            ? "Quando a franquia acabar, a IA continua até o teto de excedente que você definiu, e depois para."
            : "Quando a franquia acabar, a IA para até o próximo ciclo. Para não parar, defina um teto de excedente em reais na página de assinatura.",
        ],
        highlight: renewal ? `A franquia vira em ${renewal}.` : null,
      })
    case "ai_quota_100":
      return renderEmail(params.brand, {
        ...common,
        subject: `A franquia de IA de ${organization} acabou`,
        preheader: overageOn
          ? "A IA segue no excedente que você autorizou."
          : "A IA fica pausada até o próximo ciclo ou até você liberar um excedente.",
        heading: "A franquia de IA acabou",
        paragraphs: [
          `A imobiliária ${organization} usou toda a franquia de IA deste ciclo (${usage}).`,
          overageOn
            ? `A IA continua funcionando dentro do teto de excedente de ${formatBRL(safeCount(params.overageCapCents))} que você autorizou. Quando esse teto acabar, ela para até o próximo ciclo.`
            : "A IA fica pausada até o próximo ciclo. Para voltar a usar agora, defina um teto de excedente em reais na página de assinatura ou mude de plano.",
          "O restante do CRM continua funcionando normalmente.",
        ],
        highlight: renewal ? `A franquia volta em ${renewal}.` : null,
      })
    default:
      throw new EmailTemplateError("Tipo de aviso de IA inválido.")
  }
}
