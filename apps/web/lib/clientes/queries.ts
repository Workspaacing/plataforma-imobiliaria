import "server-only"

import { cache } from "react"
import { z } from "zod"

import { CLIENTS_PAGE_SIZE } from "@/lib/clientes/constants"
import { UNASSIGNED_FILTER, type ClientListFilters } from "@/lib/clientes/filters"
import { buildClientSearchFilter } from "@/lib/clientes/search"
import { createClient } from "@/lib/supabase/server"

const CLIENT_LIST_COLUMNS =
  "id, kind, name, trade_name, document, email, phone, whatsapp, assigned_to, source, tags, created_at"

export async function listClients(organizationId: string, filters: ClientListFilters) {
  const supabase = await createClient()
  const from = (filters.pagina - 1) * CLIENTS_PAGE_SIZE

  let query = supabase
    .from("clients")
    .select(CLIENT_LIST_COLUMNS, { count: "exact" })
    .eq("organization_id", organizationId)

  if (filters.busca) {
    query = query.or(buildClientSearchFilter(filters.busca))
  }

  if (filters.tipo) {
    query = query.eq("kind", filters.tipo)
  }

  if (filters.responsavel === UNASSIGNED_FILTER) {
    query = query.is("assigned_to", null)
  } else if (filters.responsavel) {
    query = query.eq("assigned_to", filters.responsavel)
  }

  if (filters.origem) {
    query = query.eq("source", filters.origem)
  }

  if (filters.etiqueta) {
    query = query.contains("tags", [filters.etiqueta])
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + CLIENTS_PAGE_SIZE - 1)

  if (error) {
    // Página além do fim (PGRST103): lista vazia, sem tratar como falha.
    return {
      rows: [],
      total: count ?? 0,
      failed: error.code !== "PGRST103",
    }
  }

  return { rows: data, total: count ?? data.length, failed: false }
}

export type ClientListRow = Awaited<ReturnType<typeof listClients>>["rows"][number]

/** Etiquetas já usadas nos clientes visíveis (para o filtro e sugestões). */
export async function listClientTags(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("tags")
    .eq("organization_id", organizationId)
    .limit(1000)

  if (error) {
    return []
  }

  return [...new Set(data.flatMap((row) => row.tags))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  )
}

/** Cliente da imobiliária atual; null se o id é inválido, não existe ou o RLS esconde. */
export const getClient = cache(async (organizationId: string, clientId: string) => {
  if (!z.guid().safeParse(clientId).success) {
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(`Não foi possível carregar o cliente (${error.code ?? "erro"}).`)
  }

  return data
})
