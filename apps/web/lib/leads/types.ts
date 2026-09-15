import type { Enums } from "@workspace/database/types"

import type { LeadRow, LeadSource, LeadStage } from "@/lib/leads/db-types"
import {
  detectAdPlatforms,
  readClickIdsFromUrl,
  readLeadClickIds,
  readLeadUtm,
  stripClickIdParams,
  type LeadAdPlatform,
  type LeadClickIds,
  type LeadUtm,
} from "@/lib/leads/format"

export type LeadPropertyRef = { id: string; code: string; title: string }

export type LeadLandingPageRef = { id: string; name: string; slug: string; template: string }

/** Outro lead ou cliente com o mesmo telefone ou e-mail (possível duplicado). */
export type LeadDuplicateRef = {
  kind: "lead" | "client"
  id: string
  name: string
  createdAt: string
  /** Etapa, quando o relacionado é um lead. */
  stage: LeadStage | null
  matchedBy: ("phone" | "email")[]
}

/** Lead como a interface usa (camelCase, referências resolvidas). */
export type LeadItem = {
  id: string
  name: string
  email: string | null
  phone: string | null
  message: string | null
  interest: string | null
  typology: string | null
  source: LeadSource
  landingPageId: string | null
  landingPage: LeadLandingPageRef | null
  /** URL de entrada; sem os parâmetros de click id para quem não é dono/gerente. */
  landingUrl: string | null
  propertyId: string | null
  property: LeadPropertyRef | null
  clientId: string | null
  stage: LeadStage
  position: number | null
  assignedTo: string | null
  utm: LeadUtm
  /** Plataforma de anúncio detectada pelos click ids (visível a todos). */
  adPlatforms: LeadAdPlatform[]
  /** Ids crus de clique: só para dono e gerente (null para os demais). */
  clickIds: LeadClickIds | null
  /** Id do evento (deduplicação de conversões): só para dono e gerente. */
  eventId: string | null
  referrer: string | null
  consentAt: string | null
  lostReason: string | null
  lastContactAt: string | null
  createdAt: string
  updatedAt: string
  duplicates: LeadDuplicateRef[]
}

export type LeadRefs = {
  landingPages: ReadonlyMap<string, LeadLandingPageRef>
  properties: ReadonlyMap<string, LeadPropertyRef>
  duplicates: ReadonlyMap<string, LeadDuplicateRef[]>
}

export type LeadItemOptions = {
  /** Dono/gerente: recebe click ids crus, event_id e URLs completas. */
  showTrackingIds: boolean
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function toLeadItem(row: LeadRow, refs: LeadRefs, options: LeadItemOptions): LeadItem {
  // Colunas novas podem ainda não existir no banco: `?? null` cobre o undefined.
  const landingUrl = row.landing_url ?? null
  const storedClickIds = readLeadClickIds(row.click_ids ?? null)
  const clickIds =
    Object.keys(storedClickIds).length > 0 ? storedClickIds : readClickIdsFromUrl(landingUrl)
  const hasClickIds = Object.keys(clickIds).length > 0
  const { showTrackingIds } = options

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    interest: row.interest,
    typology: row.typology ?? null,
    source: row.source,
    landingPageId: row.landing_page_id,
    landingPage: row.landing_page_id ? (refs.landingPages.get(row.landing_page_id) ?? null) : null,
    landingUrl: showTrackingIds ? landingUrl : stripClickIdParams(landingUrl),
    propertyId: row.property_id,
    property: row.property_id ? (refs.properties.get(row.property_id) ?? null) : null,
    clientId: row.client_id,
    stage: row.stage,
    position: toNumberOrNull(row.position),
    assignedTo: row.assigned_to,
    utm: readLeadUtm(row.utm),
    adPlatforms: detectAdPlatforms(clickIds),
    clickIds: showTrackingIds && hasClickIds ? clickIds : null,
    eventId: showTrackingIds ? (row.event_id ?? null) : null,
    referrer: showTrackingIds || !row.referrer ? row.referrer : (stripClickIdParams(row.referrer) ?? row.referrer),
    consentAt: row.consent_at,
    lostReason: row.lost_reason,
    lastContactAt: row.last_contact_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    duplicates: refs.duplicates.get(row.id) ?? [],
  }
}

export type LeadClientSummary = {
  id: string
  name: string
  kind: Enums<"client_kind">
}

export type LeadActivityItem = {
  id: string
  type: Enums<"activity_type">
  body: string | null
  occurredAt: string
  createdBy: string | null
  property: LeadPropertyRef | null
}

/** Dados que só existem depois da conversão (ficha do cliente e histórico). */
export type LeadDetailExtras = {
  client: LeadClientSummary | null
  activities: LeadActivityItem[]
  activitiesFailed: boolean
}

export const EMPTY_LEAD_DETAIL_EXTRAS: LeadDetailExtras = {
  client: null,
  activities: [],
  activitiesFailed: false,
}

export type LeadSummaryCounts = {
  /** Etapa "Novo" e nenhum contato registrado. */
  newWithoutContact: number
  /** Dos acima, os que passaram da meta de primeiro contato. */
  overdue: number
  /** Entraram hoje (fuso de Brasília). */
  today: number
  failed: boolean
}
