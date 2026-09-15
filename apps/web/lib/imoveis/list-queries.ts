import "server-only"

import type { Tables } from "@workspace/database/types"

import { LISTING_PURPOSES, PROPERTIES_PAGE_SIZE, PROPERTY_STATUSES, PROPERTY_TYPES } from "@/lib/imoveis/constants"
import type { ServerSupabaseClient } from "@/lib/imoveis/queries"

type SearchParams = Record<string, string | string[] | undefined>

export type PropertyListFilters = {
  q: string
  status: (typeof PROPERTY_STATUSES)[number] | ""
  purpose: (typeof LISTING_PURPOSES)[number] | ""
  type: (typeof PROPERTY_TYPES)[number] | ""
  minPrice: number | null
  maxPrice: number | null
  minBedrooms: number | null
  page: number
}

/** Nomes dos searchParams em pt-BR. */
export const PROPERTY_LIST_PARAMS = {
  q: "q",
  status: "status",
  purpose: "finalidade",
  type: "tipo",
  minPrice: "precoMin",
  maxPrice: "precoMax",
  minBedrooms: "quartos",
  page: "pagina",
} as const

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
}

function pick<T extends string>(value: string, allowed: readonly T[]): T | "" {
  return (allowed as readonly string[]).includes(value) ? (value as T) : ""
}

function positiveInteger(value: string, max: number) {
  const digits = value.replace(/\D/g, "")
  if (!digits) return null
  const parsed = Number(digits)
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null
}

export function parsePropertyListFilters(params: SearchParams): PropertyListFilters {
  return {
    q: first(params[PROPERTY_LIST_PARAMS.q]).slice(0, 100),
    status: pick(first(params[PROPERTY_LIST_PARAMS.status]), PROPERTY_STATUSES),
    purpose: pick(first(params[PROPERTY_LIST_PARAMS.purpose]), LISTING_PURPOSES),
    type: pick(first(params[PROPERTY_LIST_PARAMS.type]), PROPERTY_TYPES),
    minPrice: positiveInteger(first(params[PROPERTY_LIST_PARAMS.minPrice]), 999_999_999_999),
    maxPrice: positiveInteger(first(params[PROPERTY_LIST_PARAMS.maxPrice]), 999_999_999_999),
    minBedrooms: positiveInteger(first(params[PROPERTY_LIST_PARAMS.minBedrooms]), 99),
    page: Math.max(1, positiveInteger(first(params[PROPERTY_LIST_PARAMS.page]), 100_000) ?? 1),
  }
}

export function hasActiveFilters(filters: PropertyListFilters) {
  return Boolean(
    filters.q ||
      filters.status ||
      filters.purpose ||
      filters.type ||
      filters.minPrice != null ||
      filters.maxPrice != null ||
      filters.minBedrooms != null
  )
}

/** searchParams (sem a página) para montar links de paginação. */
export function filtersToSearchParams(filters: PropertyListFilters) {
  const params = new URLSearchParams()
  if (filters.q) params.set(PROPERTY_LIST_PARAMS.q, filters.q)
  if (filters.status) params.set(PROPERTY_LIST_PARAMS.status, filters.status)
  if (filters.purpose) params.set(PROPERTY_LIST_PARAMS.purpose, filters.purpose)
  if (filters.type) params.set(PROPERTY_LIST_PARAMS.type, filters.type)
  if (filters.minPrice != null) params.set(PROPERTY_LIST_PARAMS.minPrice, String(filters.minPrice))
  if (filters.maxPrice != null) params.set(PROPERTY_LIST_PARAMS.maxPrice, String(filters.maxPrice))
  if (filters.minBedrooms != null) params.set(PROPERTY_LIST_PARAMS.minBedrooms, String(filters.minBedrooms))
  return params
}

export type PropertyListItem = Pick<
  Tables<"properties">,
  | "id"
  | "code"
  | "title"
  | "neighborhood"
  | "city"
  | "state"
  | "purpose"
  | "type"
  | "status"
  | "sale_price"
  | "rent_price"
  | "imob_score"
  | "captured_by"
  | "broker_id"
  | "published_to_portals"
> & { coverPath: string | null }

export type PropertyListResult = {
  items: PropertyListItem[]
  total: number
  page: number
  pageCount: number
  /** Página pedida além da última. */
  outOfRange: boolean
}

/** Remove caracteres com significado na sintaxe de filtros do PostgREST. */
function sanitizeSearchTerm(value: string) {
  return value.replace(/[%_,()"'\\*:.]/g, " ").replace(/\s+/g, " ").trim()
}

function priceRange(column: "sale_price" | "rent_price", min: number | null, max: number | null) {
  const parts: string[] = []
  if (min != null) parts.push(`${column}.gte.${min}`)
  if (max != null) parts.push(`${column}.lte.${max}`)
  return parts
}

export async function listProperties(
  supabase: ServerSupabaseClient,
  organizationId: string,
  filters: PropertyListFilters
): Promise<PropertyListResult> {
  const from = (filters.page - 1) * PROPERTIES_PAGE_SIZE
  const to = from + PROPERTIES_PAGE_SIZE - 1

  let query = supabase
    .from("properties")
    .select(
      "id, code, title, neighborhood, city, state, purpose, type, status, sale_price, rent_price, imob_score, captured_by, broker_id, published_to_portals, property_media(storage_path, is_cover, position)",
      { count: "exact" }
    )
    .eq("organization_id", organizationId)
    // Só a capa (ou a primeira foto) de cada imóvel.
    .eq("property_media.kind", "image")
    .order("is_cover", { referencedTable: "property_media", ascending: false })
    .order("position", { referencedTable: "property_media" })
    .limit(1, { referencedTable: "property_media" })

  const term = sanitizeSearchTerm(filters.q)
  if (term) {
    query = query.or(`code.ilike."%${term}%",title.ilike."%${term}%",neighborhood.ilike."%${term}%"`)
  }

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.type) query = query.eq("type", filters.type)

  // "Venda" inclui imóveis de venda e locação; idem "Locação".
  if (filters.purpose === "sale") query = query.in("purpose", ["sale", "sale_rent"])
  else if (filters.purpose === "rent") query = query.in("purpose", ["rent", "sale_rent"])
  else if (filters.purpose === "sale_rent") query = query.eq("purpose", "sale_rent")

  if (filters.minPrice != null || filters.maxPrice != null) {
    const sale = priceRange("sale_price", filters.minPrice, filters.maxPrice)
    const rent = priceRange("rent_price", filters.minPrice, filters.maxPrice)

    if (filters.purpose === "sale") {
      query = query.or(`and(${sale.join(",")})`)
    } else if (filters.purpose === "rent") {
      query = query.or(`and(${rent.join(",")})`)
    } else {
      query = query.or(`and(${sale.join(",")}),and(${rent.join(",")})`)
    }
  }

  if (filters.minBedrooms != null) query = query.gte("bedrooms", filters.minBedrooms)

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("code", { ascending: false })
    .range(from, to)

  if (error) {
    // PGRST103: página além do total.
    if (error.code === "PGRST103") {
      return { items: [], total: count ?? 0, page: filters.page, pageCount: 0, outOfRange: true }
    }
    throw new Error(`Não foi possível carregar os imóveis (${error.code ?? "erro"}).`)
  }

  const total = count ?? 0
  const items: PropertyListItem[] = (data ?? []).map(({ property_media: media, ...property }) => ({
    ...property,
    coverPath: media?.[0]?.storage_path ?? null,
  }))

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PROPERTIES_PAGE_SIZE)),
    outOfRange: items.length === 0 && total > 0,
  }
}
