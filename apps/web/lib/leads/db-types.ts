import type { Database, Json } from "@workspace/database/types"

/**
 * Espelho da tabela `leads` (e do mínimo de `landing_pages`) enquanto a
 * migração do funil não entra nos tipos gerados de @workspace/database.
 *
 * TODO: trocar pelos tipos gerados (Tables<"leads">, Enums<"lead_stage">,
 * Enums<"lead_source">, Tables<"landing_pages">) quando a migração for aplicada
 * e `packages/database/src/types.ts` for regenerado; depois disso
 * `createLeadsClient` (lib/leads/db.ts) pode voltar a ser o `createClient` comum.
 */

export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "visit_scheduled"
  | "proposal"
  | "won"
  | "lost"

export type LeadSource =
  | "landing_page"
  | "portal"
  | "website"
  | "social"
  | "referral"
  | "manual"
  | "other"

/** `leads.interest` é texto livre no banco; o app usa estes valores. */
export type LeadInterest = "buy" | "rent" | "invest" | "sell" | "info"

type LeadsTable = {
  Row: {
    id: string
    organization_id: string
    name: string
    email: string | null
    phone: string | null
    message: string | null
    interest: string | null
    source: LeadSource
    landing_page_id: string | null
    property_id: string | null
    client_id: string | null
    stage: LeadStage
    position: number | null
    assigned_to: string | null
    utm: Json | null
    referrer: string | null
    consent_at: string | null
    lost_reason: string | null
    last_contact_at: string | null
    /** { gclid, gbraid, wbraid, fbclid, fbc, fbp } */
    click_ids: Json | null
    landing_url: string | null
    event_id: string | null
    typology: string | null
    created_by: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    organization_id: string
    name: string
    email?: string | null
    phone?: string | null
    message?: string | null
    interest?: string | null
    source?: LeadSource
    landing_page_id?: string | null
    property_id?: string | null
    client_id?: string | null
    stage?: LeadStage
    position?: number | null
    assigned_to?: string | null
    utm?: Json | null
    referrer?: string | null
    consent_at?: string | null
    lost_reason?: string | null
    last_contact_at?: string | null
    click_ids?: Json | null
    landing_url?: string | null
    event_id?: string | null
    typology?: string | null
    created_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    organization_id?: string
    name?: string
    email?: string | null
    phone?: string | null
    message?: string | null
    interest?: string | null
    source?: LeadSource
    landing_page_id?: string | null
    property_id?: string | null
    client_id?: string | null
    stage?: LeadStage
    position?: number | null
    assigned_to?: string | null
    utm?: Json | null
    referrer?: string | null
    consent_at?: string | null
    lost_reason?: string | null
    last_contact_at?: string | null
    click_ids?: Json | null
    landing_url?: string | null
    event_id?: string | null
    typology?: string | null
    created_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Relationships: []
}

/** Só as colunas de landing_pages que o funil usa (id, nome, modelo e slug). */
type LandingPagesTable = {
  Row: {
    id: string
    organization_id: string
    name: string
    template: string
    slug: string
  }
  Insert: {
    id?: string
    organization_id: string
    name: string
    template: string
    slug: string
  }
  Update: {
    id?: string
    organization_id?: string
    name?: string
    template?: string
    slug?: string
  }
  Relationships: []
}

type PublicSchema = Database["public"]

export type LeadsDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Enums"> & {
    Tables: PublicSchema["Tables"] & {
      leads: LeadsTable
      landing_pages: LandingPagesTable
    }
    Enums: PublicSchema["Enums"] & {
      lead_stage: LeadStage
      lead_source: LeadSource
    }
  }
}

export type LeadRow = LeadsTable["Row"]
export type LeadInsert = LeadsTable["Insert"]
export type LeadUpdate = LeadsTable["Update"]
export type LandingPageRow = LandingPagesTable["Row"]
