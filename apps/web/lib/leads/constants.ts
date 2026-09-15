import type { ClientSource } from "@/lib/clientes/constants"
import type { LeadInterest, LeadSource, LeadStage } from "@/lib/leads/db-types"

export const LEADS_PATH = "/leads"

/** Máximo de leads carregados no quadro (os mais recentes). */
export const LEADS_LIST_LIMIT = 1000

/**
 * Meta de primeiro contato: lead em "Novo" sem contato além disto fica fora do
 * prazo (responder em até 5 min converte muito mais que a média de horas).
 */
export const LEAD_RESPONSE_TARGET_MINUTES = 5

/** Janela para apontar possível duplicado (mesmo telefone ou e-mail). */
export const LEAD_DUPLICATE_WINDOW_DAYS = 90
/** Registros relacionados guardados por lead. */
export const LEAD_DUPLICATES_MAX = 10

/** Espaçamento padrão entre posições ao renumerar uma coluna. */
export const LEAD_POSITION_STEP = 1024

export const LEAD_LOST_REASON_MAX_LENGTH = 500
export const LEAD_MESSAGE_MAX_LENGTH = 5000
export const LEAD_NAME_MAX_LENGTH = 200

// -----------------------------------------------------------------------------
// Etapas do funil (enum lead_stage)
// -----------------------------------------------------------------------------
export const LEAD_STAGES = [
  "new",
  "contacted",
  "qualified",
  "visit_scheduled",
  "proposal",
  "won",
  "lost",
] as const satisfies readonly LeadStage[]

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "Novo",
  contacted: "Em contato",
  qualified: "Qualificado",
  visit_scheduled: "Visita agendada",
  proposal: "Proposta",
  won: "Ganho",
  lost: "Perdido",
}

/** Colunas que começam recolhidas no quadro (mostram só a contagem). */
export const COLLAPSED_BY_DEFAULT_STAGES: readonly LeadStage[] = ["won", "lost"]

/** Etapas ainda em aberto (ganho e perdido encerram o lead). */
export const OPEN_LEAD_STAGES: readonly LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "visit_scheduled",
  "proposal",
]

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && (LEAD_STAGES as readonly string[]).includes(value)
}

// -----------------------------------------------------------------------------
// Origem (enum lead_source)
// -----------------------------------------------------------------------------
export const LEAD_SOURCES = [
  "landing_page",
  "portal",
  "website",
  "social",
  "referral",
  "manual",
  "other",
] as const satisfies readonly LeadSource[]

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  landing_page: "Landing page",
  portal: "Portal",
  website: "Site",
  social: "Redes sociais",
  referral: "Indicação",
  manual: "Cadastro manual",
  other: "Outro",
}

/** Origens que a equipe escolhe no cadastro manual (landing page vem só do formulário público). */
export const MANUAL_LEAD_SOURCES = [
  "manual",
  "portal",
  "website",
  "social",
  "referral",
  "other",
] as const satisfies readonly LeadSource[]

export function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === "string" && (LEAD_SOURCES as readonly string[]).includes(value)
}

/**
 * Origem do cliente criado na conversão. `clients.source` só aceita os valores
 * de CLIENT_SOURCE_VALUES no formulário de cliente; por isso landing page vira
 * "site" e o nome da página vai para as observações do cliente.
 * TODO: usar "landing_page" quando essa origem existir em lib/clientes/constants.
 */
export const LEAD_SOURCE_TO_CLIENT_SOURCE: Record<LeadSource, ClientSource> = {
  landing_page: "site",
  website: "site",
  portal: "portal",
  social: "redes_sociais",
  referral: "indicacao",
  manual: "outro",
  other: "outro",
}

// -----------------------------------------------------------------------------
// Interesse (leads.interest)
// -----------------------------------------------------------------------------
export const LEAD_INTERESTS = ["buy", "rent", "invest", "sell", "info"] as const satisfies readonly LeadInterest[]

export const LEAD_INTEREST_LABELS: Record<LeadInterest, string> = {
  buy: "Comprar",
  rent: "Alugar",
  invest: "Investir",
  sell: "Vender",
  info: "Informações",
}

export function isLeadInterest(value: unknown): value is LeadInterest {
  return typeof value === "string" && (LEAD_INTERESTS as readonly string[]).includes(value)
}

export function getLeadInterestLabel(value: string | null | undefined) {
  if (!value) return null
  return isLeadInterest(value) ? LEAD_INTEREST_LABELS[value] : value
}

/** Sugestões rápidas de motivo de perda (o texto continua livre). */
export const LEAD_LOST_REASON_SUGGESTIONS = [
  "Sem resposta após várias tentativas",
  "Comprou/alugou com outra imobiliária",
  "Fora do orçamento",
  "Desistiu da mudança",
  "Contato inválido",
] as const
