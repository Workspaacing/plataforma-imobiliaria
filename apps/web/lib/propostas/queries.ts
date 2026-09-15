import "server-only"

import type { Enums } from "@workspace/database/types"

import { getProfileNames } from "@/lib/propostas/options"
import type { ProposalStatus } from "@/lib/propostas/status"
import type { createClient } from "@/lib/supabase/server"

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type ProposalPurpose = "sale" | "rent"

export type ProposalFilters = {
  status: ProposalStatus | null
  propertyId: string | null
  brokerId: string | null
  purpose: ProposalPurpose | null
}

export type ProposalRow = {
  id: string
  status: ProposalStatus
  purpose: ProposalPurpose
  amount: number
  paymentTerms: string | null
  conditions: string | null
  validUntil: string | null
  decidedAt: string | null
  createdAt: string
  brokerId: string | null
  brokerLabel: string | null
  propertyId: string
  clientId: string
  property: {
    id: string
    code: string
    title: string
    status: Enums<"property_status">
    capturedBy: string | null
    brokerId: string | null
  } | null
  client: { id: string; name: string } | null
}

export type ProposalCounts = Record<ProposalStatus | "all", number>

export async function listProposals(
  supabase: ServerClient,
  organizationId: string,
  filters: ProposalFilters
): Promise<{ rows: ProposalRow[]; counts: ProposalCounts }> {
  let rowsQuery = supabase
    .from("proposals")
    .select(
      "id, status, purpose, amount, payment_terms, conditions, valid_until, decided_at, created_at, broker_id, property_id, client_id, property:properties!proposals_property_fkey(id, code, title, status, captured_by, broker_id), client:clients!proposals_client_fkey(id, name)"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(500)

  // As contagens por status respeitam os demais filtros.
  let countsQuery = supabase
    .from("proposals")
    .select("status")
    .eq("organization_id", organizationId)
    .limit(5000)

  if (filters.propertyId) {
    rowsQuery = rowsQuery.eq("property_id", filters.propertyId)
    countsQuery = countsQuery.eq("property_id", filters.propertyId)
  }

  if (filters.brokerId) {
    rowsQuery = rowsQuery.eq("broker_id", filters.brokerId)
    countsQuery = countsQuery.eq("broker_id", filters.brokerId)
  }

  if (filters.purpose) {
    rowsQuery = rowsQuery.eq("purpose", filters.purpose)
    countsQuery = countsQuery.eq("purpose", filters.purpose)
  }

  if (filters.status) {
    rowsQuery = rowsQuery.eq("status", filters.status)
  }

  const [rowsResult, countsResult] = await Promise.all([rowsQuery, countsQuery])

  if (rowsResult.error) {
    throw new Error(`Não foi possível carregar as propostas (${rowsResult.error.code ?? "erro"}).`)
  }

  if (countsResult.error) {
    throw new Error(
      `Não foi possível contar as propostas (${countsResult.error.code ?? "erro"}).`
    )
  }

  const counts: ProposalCounts = {
    all: 0,
    draft: 0,
    sent: 0,
    countered: 0,
    accepted: 0,
    rejected: 0,
    withdrawn: 0,
  }

  for (const row of countsResult.data) {
    counts.all += 1
    counts[row.status] += 1
  }

  const names = await getProfileNames(
    supabase,
    rowsResult.data.flatMap((row) => (row.broker_id ? [row.broker_id] : []))
  )

  const rows: ProposalRow[] = rowsResult.data.map((row) => ({
    id: row.id,
    status: row.status,
    purpose: row.purpose === "rent" ? "rent" : "sale",
    amount: row.amount,
    paymentTerms: row.payment_terms,
    conditions: row.conditions,
    validUntil: row.valid_until,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    brokerId: row.broker_id,
    brokerLabel: row.broker_id ? (names.get(row.broker_id) ?? "Ex-membro da equipe") : null,
    propertyId: row.property_id,
    clientId: row.client_id,
    property: row.property
      ? {
          id: row.property.id,
          code: row.property.code,
          title: row.property.title,
          status: row.property.status,
          capturedBy: row.property.captured_by,
          brokerId: row.property.broker_id,
        }
      : null,
    client: row.client ? { id: row.client.id, name: row.client.name } : null,
  }))

  return { rows, counts }
}
