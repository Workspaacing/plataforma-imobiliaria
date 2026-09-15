import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@workspace/database/types"

import type { LandingStatus } from "@/lib/marketing/constants"

/*
 * TODO: trocar pelos tipos gerados. Enquanto `@workspace/database/types` não
 * tiver `landing_pages` (migração ainda não aplicada/regenerada), este arquivo
 * espelha a tabela para as queries tipadas. Depois de regenerar:
 *   - LandingPageRow    -> Tables<"landing_pages">
 *   - MarketingDatabase -> Database
 *   - asMarketingClient -> remover (usar o cliente direto)
 */

export type LandingPageRow = {
  id: string
  organization_id: string
  /** Enum landing_template (as 9 chaves de LANDING_TEMPLATES). */
  template: string
  name: string
  slug: string
  status: LandingStatus
  published_at: string | null
  theme: Json
  content: Json
  property_ids: string[]
  tracking: Json
  seo: Json
  lead_assignee_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type LandingPageInsert = {
  id?: string
  organization_id: string
  template: string
  name: string
  slug: string
  status?: LandingStatus
  published_at?: string | null
  theme?: Json
  content?: Json
  property_ids?: string[]
  tracking?: Json
  seo?: Json
  lead_assignee_id?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export type LandingPageUpdate = Partial<LandingPageInsert>

type PublicSchema = Database["public"]

export type MarketingDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Enums"> & {
    Tables: PublicSchema["Tables"] & {
      landing_pages: {
        Row: LandingPageRow
        Insert: LandingPageInsert
        Update: LandingPageUpdate
        Relationships: []
      }
    }
    Enums: PublicSchema["Enums"] & {
      landing_status: LandingStatus
      landing_template: string
    }
  }
}

export type MarketingSupabaseClient = SupabaseClient<MarketingDatabase>

/** Cliente tipado com landing_pages (ver TODO acima). */
export function asMarketingClient(client: SupabaseClient<Database>): MarketingSupabaseClient {
  return client as unknown as MarketingSupabaseClient
}

/**
 * Cliente sem tipos para tabelas opcionais criadas por outros módulos (ex.:
 * `leads`), cuja existência é checada em tempo de execução.
 */
export function asUntypedClient(client: SupabaseClient<Database>): SupabaseClient {
  return client as unknown as SupabaseClient
}
