import type { Json } from "@workspace/database/types"

import type { LeadClickIds, LeadInterest, LeadUtm } from "@/lib/leads-publicos/constants"

/** Corpo de p_payload em submit_landing_lead (chaves opcionais vazias são omitidas). */
export type LandingLeadPayload = {
  name: string
  email?: string
  phone?: string
  message?: string
  property_id?: string
  interest?: LeadInterest
  /** Nome da tipologia escolhida (até 80). */
  typology?: string
  utm: LeadUtm
  /** gclid, gbraid, wbraid, fbclid, fbc, fbp (cada um até 255). */
  click_ids: LeadClickIds
  /** URL da landing sem dados pessoais (até 500). */
  landing_url?: string
  referrer?: string
  /** UUID compartilhado com os eventos do Meta Pixel/Google (deduplicação). */
  event_id: string
  consent: true
}

/**
 * Tipagem local das RPCs públicas das landing pages.
 *
 * TODO: trocar pelos tipos gerados (@workspace/database/types) assim que as
 * migrações de get_public_landing_page e submit_landing_lead forem aplicadas
 * e os tipos regenerados; depois, apagar este arquivo.
 */
export type LandingRpcDatabase = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: { [_ in never]: never }
    Views: { [_ in never]: never }
    Functions: {
      get_public_landing_page: {
        Args: { p_org_slug: string; p_page_slug: string }
        Returns: Json
      }
      submit_landing_lead: {
        Args: {
          p_org_slug: string
          p_page_slug: string
          p_payload: LandingLeadPayload
          p_server_key: string
          p_nonce: string
          p_client_key: string
        }
        Returns: undefined
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
