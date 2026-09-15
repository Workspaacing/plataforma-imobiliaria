import "server-only"

import { cache } from "react"
import { z } from "zod"

import { toDateKey, zonedToIso } from "@/lib/agenda/datetime"
import {
  LEAD_DUPLICATE_WINDOW_DAYS,
  LEAD_DUPLICATES_MAX,
  LEAD_RESPONSE_TARGET_MINUTES,
  LEADS_LIST_LIMIT,
} from "@/lib/leads/constants"
import { createLeadsClient, type LeadsServerClient } from "@/lib/leads/db"
import type { LeadRow } from "@/lib/leads/db-types"
import {
  getPeriodStartIso,
  MINE_FILTER,
  UNASSIGNED_FILTER,
  type LeadListFilters,
} from "@/lib/leads/filters"
import { duplicateEmailKey, duplicatePhoneKey, readLeadUtm } from "@/lib/leads/format"
import {
  EMPTY_LEAD_DETAIL_EXTRAS,
  toLeadItem,
  type LeadActivityItem,
  type LeadDetailExtras,
  type LeadDuplicateRef,
  type LeadItem,
  type LeadItemOptions,
  type LeadLandingPageRef,
  type LeadPropertyRef,
  type LeadSummaryCounts,
} from "@/lib/leads/types"

/** Tamanho dos lotes de `.in(...)` para não estourar o limite da URL. */
const IN_CHUNK_SIZE = 150
/** Leads da janela de duplicidade lidos para comparar telefone/e-mail. */
const DUPLICATE_SCAN_LIMIT = 5000
const DAY_MS = 24 * 60 * 60 * 1000

function chunk<T>(items: readonly T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

/** Landing pages da imobiliária (para o filtro e o nome no card). Falha vira lista vazia. */
export async function listLandingPages(
  supabase: LeadsServerClient,
  organizationId: string
): Promise<LeadLandingPageRef[]> {
  const { data, error } = await supabase
    .from("landing_pages")
    .select("id, name, slug, template")
    .eq("organization_id", organizationId)
    .order("name")
    .limit(500)

  if (error) {
    return []
  }

  return data.map((page) => ({
    id: page.id,
    name: page.name,
    slug: page.slug,
    template: page.template,
  }))
}

async function loadPropertyRefs(
  supabase: LeadsServerClient,
  organizationId: string,
  ids: readonly string[]
) {
  const properties = new Map<string, LeadPropertyRef>()
  const unique = [...new Set(ids)]

  const results = await Promise.all(
    chunk(unique, IN_CHUNK_SIZE).map((part) =>
      supabase
        .from("properties")
        .select("id, code, title")
        .eq("organization_id", organizationId)
        .in("id", part)
    )
  )

  for (const { data } of results) {
    for (const property of data ?? []) {
      properties.set(property.id, property)
    }
  }

  return properties
}

// -----------------------------------------------------------------------------
// Possível duplicado (em lote, sem N+1)
// -----------------------------------------------------------------------------

type DuplicateCandidate = Omit<LeadDuplicateRef, "matchedBy">

function pushIndexed(index: Map<string, DuplicateCandidate[]>, key: string | null, item: DuplicateCandidate) {
  if (!key) return

  const list = index.get(key)

  if (!list) {
    index.set(key, [item])
  } else if (!list.some((existing) => existing.kind === item.kind && existing.id === item.id)) {
    list.push(item)
  }
}

/**
 * Para cada lead informado, outros leads e clientes da imobiliária com o mesmo
 * telefone (só dígitos, últimos 11) ou e-mail (minúsculo, sem espaços) criados
 * nos últimos LEAD_DUPLICATE_WINDOW_DAYS dias. Três consultas no total (mais os
 * lotes de `.in`), qualquer que seja o número de leads. O RLS limita a busca
 * ao que o usuário pode ver.
 */
export async function findLeadDuplicates(
  supabase: LeadsServerClient,
  organizationId: string,
  rows: readonly LeadRow[],
  now: Date
): Promise<Map<string, LeadDuplicateRef[]>> {
  const duplicates = new Map<string, LeadDuplicateRef[]>()
  const phoneKeys = new Set<string>()
  const emailKeys = new Set<string>()

  for (const row of rows) {
    const phone = duplicatePhoneKey(row.phone)
    const email = duplicateEmailKey(row.email)
    if (phone) phoneKeys.add(phone)
    if (email) emailKeys.add(email)
  }

  if (phoneKeys.size === 0 && emailKeys.size === 0) {
    return duplicates
  }

  const windowStart = new Date(now.getTime() - LEAD_DUPLICATE_WINDOW_DAYS * DAY_MS).toISOString()
  const clientColumns = "id, name, email, phone, whatsapp, created_at"

  // Telefone de lead pode vir em formatos diferentes (portais, integrações):
  // lê a janela uma vez e compara só os dígitos em memória.
  const leadsQuery = supabase
    .from("leads")
    .select("id, name, phone, email, stage, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(DUPLICATE_SCAN_LIMIT)

  // Clientes já guardam telefone normalizado (dígitos) e e-mail minúsculo.
  const clientQueries = [
    ...chunk([...emailKeys], IN_CHUNK_SIZE).map((part) =>
      supabase
        .from("clients")
        .select(clientColumns)
        .eq("organization_id", organizationId)
        .gte("created_at", windowStart)
        .in("email", part)
    ),
    ...chunk([...phoneKeys], IN_CHUNK_SIZE).map((part) =>
      supabase
        .from("clients")
        .select(clientColumns)
        .eq("organization_id", organizationId)
        .gte("created_at", windowStart)
        .or(`phone.in.(${part.join(",")}),whatsapp.in.(${part.join(",")})`)
    ),
  ]

  const [leadsResult, clientResults] = await Promise.all([leadsQuery, Promise.all(clientQueries)])

  if (leadsResult.error) {
    console.error("[leads] falha ao buscar leads duplicados:", leadsResult.error.code ?? "erro")
  }

  const byPhone = new Map<string, DuplicateCandidate[]>()
  const byEmail = new Map<string, DuplicateCandidate[]>()

  for (const lead of leadsResult.data ?? []) {
    const item: DuplicateCandidate = {
      kind: "lead",
      id: lead.id,
      name: lead.name,
      createdAt: lead.created_at,
      stage: lead.stage,
    }

    pushIndexed(byPhone, duplicatePhoneKey(lead.phone), item)
    pushIndexed(byEmail, duplicateEmailKey(lead.email), item)
  }

  for (const result of clientResults) {
    for (const client of result.data ?? []) {
      const item: DuplicateCandidate = {
        kind: "client",
        id: client.id,
        name: client.name,
        createdAt: client.created_at,
        stage: null,
      }

      pushIndexed(byPhone, duplicatePhoneKey(client.phone), item)
      pushIndexed(byPhone, duplicatePhoneKey(client.whatsapp), item)
      pushIndexed(byEmail, duplicateEmailKey(client.email), item)
    }
  }

  for (const row of rows) {
    const matches = new Map<string, LeadDuplicateRef>()

    const collect = (items: DuplicateCandidate[] | undefined, reason: "phone" | "email") => {
      for (const item of items ?? []) {
        const isSelf = item.kind === "lead" && item.id === row.id
        const isLinkedClient = item.kind === "client" && item.id === row.client_id

        if (isSelf || isLinkedClient) continue

        const key = `${item.kind}:${item.id}`
        const existing = matches.get(key)

        if (existing) {
          if (!existing.matchedBy.includes(reason)) existing.matchedBy.push(reason)
        } else {
          matches.set(key, { ...item, matchedBy: [reason] })
        }
      }
    }

    const phone = duplicatePhoneKey(row.phone)
    const email = duplicateEmailKey(row.email)
    collect(phone ? byPhone.get(phone) : undefined, "phone")
    collect(email ? byEmail.get(email) : undefined, "email")

    if (matches.size > 0) {
      duplicates.set(
        row.id,
        [...matches.values()]
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, LEAD_DUPLICATES_MAX)
      )
    }
  }

  return duplicates
}

async function toLeadItems(
  supabase: LeadsServerClient,
  params: {
    organizationId: string
    rows: readonly LeadRow[]
    landingPages: readonly LeadLandingPageRef[]
    now: Date
    options: LeadItemOptions
  }
) {
  const { organizationId, rows, landingPages, now, options } = params
  const propertyIds = rows.flatMap((row) => (row.property_id ? [row.property_id] : []))

  const [properties, duplicates] = await Promise.all([
    loadPropertyRefs(supabase, organizationId, propertyIds),
    findLeadDuplicates(supabase, organizationId, rows, now),
  ])

  const refs = {
    landingPages: new Map(landingPages.map((page) => [page.id, page])),
    properties,
    duplicates,
  }

  return rows.map((row) => toLeadItem(row, refs, options))
}

export type LeadListResult = {
  leads: LeadItem[]
  truncated: boolean
  failed: boolean
}

/** Leads visíveis (RLS) com os filtros da URL, dos mais recentes aos mais antigos. */
export async function listLeads(
  supabase: LeadsServerClient,
  params: {
    organizationId: string
    userId: string
    filters: LeadListFilters
    now: Date
    landingPages: readonly LeadLandingPageRef[]
    options: LeadItemOptions
  }
): Promise<LeadListResult> {
  const { organizationId, userId, filters, now, landingPages, options } = params

  let query = supabase.from("leads").select("*").eq("organization_id", organizationId)

  if (filters.responsavel === MINE_FILTER) {
    query = query.eq("assigned_to", userId)
  } else if (filters.responsavel === UNASSIGNED_FILTER) {
    query = query.is("assigned_to", null)
  } else if (filters.responsavel) {
    query = query.eq("assigned_to", filters.responsavel)
  }

  if (filters.origem) {
    query = query.eq("source", filters.origem)
  }

  if (filters.pagina) {
    query = query.eq("landing_page_id", filters.pagina)
  }

  if (filters.campanha) {
    query = query.filter("utm->>campaign", "eq", filters.campanha)
  }

  const periodStart = getPeriodStartIso(filters.periodo, now)

  if (periodStart) {
    query = query.gte("created_at", periodStart)
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .limit(LEADS_LIST_LIMIT + 1)

  if (error) {
    console.error("[leads] falha ao listar leads:", error.code ?? "erro")
    return { leads: [], truncated: false, failed: true }
  }

  const rows = data.slice(0, LEADS_LIST_LIMIT)

  return {
    leads: await toLeadItems(supabase, { organizationId, rows, landingPages, now, options }),
    truncated: data.length > LEADS_LIST_LIMIT,
    failed: false,
  }
}

/** Campanhas UTM já recebidas (para o filtro). */
export async function listLeadCampaigns(supabase: LeadsServerClient, organizationId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("utm")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(2000)

  if (error) {
    return []
  }

  const campaigns = new Set<string>()

  for (const row of data) {
    const campaign = readLeadUtm(row.utm).campaign
    if (campaign) campaigns.add(campaign)
  }

  return [...campaigns].sort((a, b) => a.localeCompare(b, "pt-BR"))
}

/** Contadores do topo (independentes dos filtros; o RLS limita ao que o usuário vê). */
export async function getLeadSummary(
  supabase: LeadsServerClient,
  organizationId: string,
  now: Date
): Promise<LeadSummaryCounts> {
  const overdueBefore = new Date(now.getTime() - LEAD_RESPONSE_TARGET_MINUTES * 60_000).toISOString()
  const todayStart = zonedToIso(toDateKey(now))

  const base = () =>
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)

  const [waiting, overdue, today] = await Promise.all([
    base().eq("stage", "new").is("last_contact_at", null),
    base().eq("stage", "new").is("last_contact_at", null).lt("created_at", overdueBefore),
    base().gte("created_at", todayStart),
  ])

  return {
    newWithoutContact: waiting.count ?? 0,
    overdue: overdue.count ?? 0,
    today: today.count ?? 0,
    failed: Boolean(waiting.error || overdue.error || today.error),
  }
}

/** Lead da imobiliária atual; null se o id é inválido, não existe ou o RLS esconde. */
export const getLead = cache(
  async (organizationId: string, leadId: string, showTrackingIds: boolean) => {
    if (!z.guid().safeParse(leadId).success) {
      return null
    }

    const supabase = await createLeadsClient()
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (error) {
      throw new Error(`Não foi possível carregar o lead (${error.code ?? "erro"}).`)
    }

    if (!data) {
      return null
    }

    const landingPages: LeadLandingPageRef[] = []

    if (data.landing_page_id) {
      const { data: page } = await supabase
        .from("landing_pages")
        .select("id, name, slug, template")
        .eq("id", data.landing_page_id)
        .eq("organization_id", organizationId)
        .maybeSingle()

      if (page) landingPages.push(page)
    }

    const [lead] = await toLeadItems(supabase, {
      organizationId,
      rows: [data],
      landingPages,
      now: new Date(),
      options: { showTrackingIds },
    })

    return lead ?? null
  }
)

/** Cliente vinculado e histórico (activities) — só existem após a conversão. */
export async function getLeadDetailExtras(
  supabase: LeadsServerClient,
  organizationId: string,
  clientId: string | null
): Promise<LeadDetailExtras> {
  if (!clientId) {
    return EMPTY_LEAD_DETAIL_EXTRAS
  }

  const [clientResult, activitiesResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, kind")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("activities")
      .select("id, type, body, occurred_at, created_by, property_id")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("occurred_at", { ascending: false })
      .limit(30),
  ])

  const activityRows = activitiesResult.data ?? []
  const properties = await loadPropertyRefs(
    supabase,
    organizationId,
    activityRows.flatMap((row) => (row.property_id ? [row.property_id] : []))
  )

  return {
    client: clientResult.data ?? null,
    activities: activityRows.map(
      (row): LeadActivityItem => ({
        id: row.id,
        type: row.type,
        body: row.body,
        occurredAt: row.occurred_at,
        createdBy: row.created_by,
        property: row.property_id ? (properties.get(row.property_id) ?? null) : null,
      })
    ),
    activitiesFailed: Boolean(activitiesResult.error),
  }
}
