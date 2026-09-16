// Gerado por `supabase gen types typescript` (MCP generate_typescript_types)
// a partir do projeto qwaywbtyfkovulvirujp. Não edite à mão: regenere após
// cada migração (ver supabase/README.md).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          body: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          occurred_at: string
          organization_id: string
          property_id: string | null
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at?: string
          organization_id: string
          property_id?: string | null
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at?: string
          organization_id?: string
          property_id?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_property_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      ai_usage_periods: {
        Row: {
          cache_read_tokens: number
          cache_write_tokens: number
          conversations: number
          cost_millicents: number
          created_at: string
          day_cost_millicents: number
          day_start: string | null
          input_tokens: number
          notified_100_at: string | null
          notified_80_at: string | null
          organization_id: string
          output_tokens: number
          period_end: string
          period_start: string
          requests: number
          updated_at: string
          week_cost_millicents: number
          week_start: string | null
        }
        Insert: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          conversations?: number
          cost_millicents?: number
          created_at?: string
          day_cost_millicents?: number
          day_start?: string | null
          input_tokens?: number
          notified_100_at?: string | null
          notified_80_at?: string | null
          organization_id: string
          output_tokens?: number
          period_end: string
          period_start: string
          requests?: number
          updated_at?: string
          week_cost_millicents?: number
          week_start?: string | null
        }
        Update: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          conversations?: number
          cost_millicents?: number
          created_at?: string
          day_cost_millicents?: number
          day_start?: string | null
          input_tokens?: number
          notified_100_at?: string | null
          notified_80_at?: string | null
          organization_id?: string
          output_tokens?: number
          period_end?: string
          period_start?: string
          requests?: number
          updated_at?: string
          week_cost_millicents?: number
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          broker_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          feedback: string | null
          id: string
          meeting_point: string | null
          organization_id: string
          property_id: string | null
          rating: number | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          broker_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          feedback?: string | null
          id?: string
          meeting_point?: string | null
          organization_id: string
          property_id?: string | null
          rating?: number | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          broker_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          feedback?: string | null
          id?: string
          meeting_point?: string | null
          organization_id?: string
          property_id?: string | null
          rating?: number | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          addon_keys: string[]
          ai_overage_cap_cents: number
          billing_interval: string | null
          cancel_at_period_end: boolean
          current_period_end: string | null
          features: string[]
          first_paid_at: string | null
          limits: Json
          organization_id: string
          plan_key: string
          plan_net_invoice_at: string | null
          plan_net_monthly_cents: number | null
          referral_confirmed_notified_at: string | null
          referral_counted_at: string | null
          referral_discount_percent: number
          referral_ineligible_at: string | null
          referral_ineligible_reason: string | null
          seats: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          synced_at: string
          trial_ends_at: string
        }
        Insert: {
          addon_keys?: string[]
          ai_overage_cap_cents?: number
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          features?: string[]
          first_paid_at?: string | null
          limits: Json
          organization_id: string
          plan_key?: string
          plan_net_invoice_at?: string | null
          plan_net_monthly_cents?: number | null
          referral_confirmed_notified_at?: string | null
          referral_counted_at?: string | null
          referral_discount_percent?: number
          referral_ineligible_at?: string | null
          referral_ineligible_reason?: string | null
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          synced_at?: string
          trial_ends_at: string
        }
        Update: {
          addon_keys?: string[]
          ai_overage_cap_cents?: number
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          features?: string[]
          first_paid_at?: string | null
          limits?: Json
          organization_id?: string
          plan_key?: string
          plan_net_invoice_at?: string | null
          plan_net_monthly_cents?: number | null
          referral_confirmed_notified_at?: string | null
          referral_counted_at?: string | null
          referral_discount_percent?: number
          referral_ineligible_at?: string | null
          referral_ineligible_reason?: string | null
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          synced_at?: string
          trial_ends_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_requests: {
        Row: {
          city: string | null
          consent_at: string
          converted_property_id: string | null
          created_at: string
          expected_price: number | null
          id: string
          message: string | null
          neighborhood: string | null
          organization_id: string
          owner_email: string | null
          owner_name: string
          owner_phone: string | null
          postal_code: string | null
          purpose: Database["public"]["Enums"]["listing_purpose"]
          state: string | null
          status: Database["public"]["Enums"]["capture_request_status"]
          type: Database["public"]["Enums"]["property_type"] | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          consent_at: string
          converted_property_id?: string | null
          created_at?: string
          expected_price?: number | null
          id?: string
          message?: string | null
          neighborhood?: string | null
          organization_id: string
          owner_email?: string | null
          owner_name: string
          owner_phone?: string | null
          postal_code?: string | null
          purpose: Database["public"]["Enums"]["listing_purpose"]
          state?: string | null
          status?: Database["public"]["Enums"]["capture_request_status"]
          type?: Database["public"]["Enums"]["property_type"] | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          consent_at?: string
          converted_property_id?: string | null
          created_at?: string
          expected_price?: number | null
          id?: string
          message?: string | null
          neighborhood?: string | null
          organization_id?: string
          owner_email?: string | null
          owner_name?: string
          owner_phone?: string | null
          postal_code?: string | null
          purpose?: Database["public"]["Enums"]["listing_purpose"]
          state?: string | null
          status?: Database["public"]["Enums"]["capture_request_status"]
          type?: Database["public"]["Enums"]["property_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_requests_converted_property_fkey"
            columns: ["organization_id", "converted_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "capture_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          id: string
          mime_type: string | null
          name: string
          organization_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "client_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_interests: {
        Row: {
          active: boolean
          city: string | null
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          max_price: number | null
          min_bedrooms: number | null
          min_parking: number | null
          min_price: number | null
          neighborhoods: string[]
          notes: string | null
          organization_id: string
          purpose: Database["public"]["Enums"]["listing_purpose"]
          types: Database["public"]["Enums"]["property_type"][]
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_price?: number | null
          min_bedrooms?: number | null
          min_parking?: number | null
          min_price?: number | null
          neighborhoods?: string[]
          notes?: string | null
          organization_id: string
          purpose: Database["public"]["Enums"]["listing_purpose"]
          types?: Database["public"]["Enums"]["property_type"][]
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_price?: number | null
          min_bedrooms?: number | null
          min_parking?: number | null
          min_price?: number | null
          neighborhoods?: string[]
          notes?: string | null
          organization_id?: string
          purpose?: Database["public"]["Enums"]["listing_purpose"]
          types?: Database["public"]["Enums"]["property_type"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_interests_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "client_interests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_shares: {
        Row: {
          client_id: string
          created_at: string
          id: string
          organization_id: string
          shared_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          organization_id: string
          shared_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          shared_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_shares_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "client_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          assigned_to: string | null
          birth_date: string | null
          city: string | null
          complement: string | null
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["client_kind"]
          lgpd_consent_at: string | null
          lgpd_legal_basis: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          rg: string | null
          source: string | null
          state: string | null
          street: string | null
          street_number: string | null
          tags: string[]
          trade_name: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          assigned_to?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_kind"]
          lgpd_consent_at?: string | null
          lgpd_legal_basis?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          rg?: string | null
          source?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          tags?: string[]
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          assigned_to?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_kind"]
          lgpd_consent_at?: string | null
          lgpd_legal_basis?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          rg?: string | null
          source?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          tags?: string[]
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      condominiums: {
        Row: {
          amenities: string[]
          avg_condo_fee: number | null
          city: string | null
          complement: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          neighborhood: string | null
          notes: string | null
          organization_id: string
          postal_code: string | null
          state: string | null
          street: string | null
          street_number: string | null
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          avg_condo_fee?: number | null
          city?: string | null
          complement?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          notes?: string | null
          organization_id: string
          postal_code?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          avg_condo_fee?: number | null
          city?: string | null
          complement?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          notes?: string | null
          organization_id?: string
          postal_code?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominiums_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      key_movements: {
        Row: {
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          key_id: string
          notes: string | null
          organization_id: string
          returned_at: string | null
          taken_at: string
          taken_by_client_id: string | null
          taken_by_user: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          key_id: string
          notes?: string | null
          organization_id: string
          returned_at?: string | null
          taken_at?: string
          taken_by_client_id?: string | null
          taken_by_user?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          key_id?: string
          notes?: string | null
          organization_id?: string
          returned_at?: string | null
          taken_at?: string
          taken_by_client_id?: string | null
          taken_by_user?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_movements_client_fkey"
            columns: ["organization_id", "taken_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "key_movements_key_fkey"
            columns: ["organization_id", "key_id"]
            isOneToOne: false
            referencedRelation: "keys"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "key_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          location: string | null
          notes: string | null
          organization_id: string
          property_id: string
          status: Database["public"]["Enums"]["key_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          location?: string | null
          notes?: string | null
          organization_id: string
          property_id: string
          status?: Database["public"]["Enums"]["key_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          location?: string | null
          notes?: string | null
          organization_id?: string
          property_id?: string
          status?: Database["public"]["Enums"]["key_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keys_property_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          lead_assignee_id: string | null
          name: string
          organization_id: string
          property_ids: string[]
          published_at: string | null
          seo: Json
          slug: string
          status: Database["public"]["Enums"]["landing_status"]
          template: Database["public"]["Enums"]["landing_template"]
          theme: Json
          tracking: Json
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          lead_assignee_id?: string | null
          name: string
          organization_id: string
          property_ids?: string[]
          published_at?: string | null
          seo?: Json
          slug: string
          status?: Database["public"]["Enums"]["landing_status"]
          template: Database["public"]["Enums"]["landing_template"]
          theme?: Json
          tracking?: Json
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          lead_assignee_id?: string | null
          name?: string
          organization_id?: string
          property_ids?: string[]
          published_at?: string | null
          seo?: Json
          slug?: string
          status?: Database["public"]["Enums"]["landing_status"]
          template?: Database["public"]["Enums"]["landing_template"]
          theme?: Json
          tracking?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          click_ids: Json
          client_id: string | null
          consent_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          event_id: string | null
          id: string
          interest: string | null
          landing_page_id: string | null
          landing_url: string | null
          last_contact_at: string | null
          lost_reason: string | null
          message: string | null
          name: string
          organization_id: string
          phone: string | null
          position: number | null
          property_id: string | null
          referrer: string | null
          source: Database["public"]["Enums"]["lead_source"]
          stage: Database["public"]["Enums"]["lead_stage"]
          typology: string | null
          updated_at: string
          utm: Json
        }
        Insert: {
          assigned_to?: string | null
          click_ids?: Json
          client_id?: string | null
          consent_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          interest?: string | null
          landing_page_id?: string | null
          landing_url?: string | null
          last_contact_at?: string | null
          lost_reason?: string | null
          message?: string | null
          name: string
          organization_id: string
          phone?: string | null
          position?: number | null
          property_id?: string | null
          referrer?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          stage?: Database["public"]["Enums"]["lead_stage"]
          typology?: string | null
          updated_at?: string
          utm?: Json
        }
        Update: {
          assigned_to?: string | null
          click_ids?: Json
          client_id?: string | null
          consent_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          interest?: string | null
          landing_page_id?: string | null
          landing_url?: string | null
          last_contact_at?: string | null
          lost_reason?: string | null
          message?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          position?: number | null
          property_id?: string | null
          referrer?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          stage?: Database["public"]["Enums"]["lead_stage"]
          typology?: string | null
          updated_at?: string
          utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "leads_landing_page_fkey"
            columns: ["organization_id", "landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      listing_authorizations: {
        Row: {
          commission_percent: number | null
          created_at: string
          created_by: string | null
          document_path: string | null
          ends_on: string | null
          exclusive: boolean
          id: string
          organization_id: string
          owner_client_id: string
          property_id: string
          signed_at: string | null
          starts_on: string
          updated_at: string
        }
        Insert: {
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          document_path?: string | null
          ends_on?: string | null
          exclusive?: boolean
          id?: string
          organization_id: string
          owner_client_id: string
          property_id: string
          signed_at?: string | null
          starts_on?: string
          updated_at?: string
        }
        Update: {
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          document_path?: string | null
          ends_on?: string | null
          exclusive?: boolean
          id?: string
          organization_id?: string
          owner_client_id?: string
          property_id?: string
          signed_at?: string | null
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_authorizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_authorizations_owner_client_fkey"
            columns: ["organization_id", "owner_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "listing_authorizations_property_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand: Json
          city: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          creci: string | null
          email: string | null
          feed_token: string
          id: string
          legal_name: string | null
          name: string
          phone: string | null
          plan: Database["public"]["Enums"]["organization_plan"]
          referral_code: string
          referred_by_organization_id: string | null
          slug: string
          state: string | null
          updated_at: string
        }
        Insert: {
          brand?: Json
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          creci?: string | null
          email?: string | null
          feed_token?: string
          id?: string
          legal_name?: string | null
          name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["organization_plan"]
          referral_code?: string
          referred_by_organization_id?: string | null
          slug: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          brand?: Json
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          creci?: string | null
          email?: string | null
          feed_token?: string
          id?: string
          legal_name?: string | null
          name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["organization_plan"]
          referral_code?: string
          referred_by_organization_id?: string | null
          slug?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_referred_by_organization_id_fkey"
            columns: ["referred_by_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          creci_number: string | null
          creci_state: string | null
          creci_valid_until: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          creci_number?: string | null
          creci_state?: string | null
          creci_valid_until?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          creci_number?: string | null
          creci_state?: string | null
          creci_valid_until?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          accepts_exchange: boolean
          accepts_pets: boolean
          address_display: Database["public"]["Enums"]["address_display"]
          bathrooms: number | null
          bedrooms: number | null
          broker_id: string | null
          captured_by: string | null
          city: string | null
          code: string
          complement: string | null
          condo_fee: number | null
          condominium_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          features: string[]
          floor: number | null
          furnished: boolean
          id: string
          imob_score: number | null
          iptu_yearly: number | null
          latitude: number | null
          living_area: number | null
          longitude: number | null
          lot_area: number | null
          neighborhood: string | null
          organization_id: string
          parking_spaces: number | null
          postal_code: string | null
          published_at: string | null
          published_to_portals: boolean
          purpose: Database["public"]["Enums"]["listing_purpose"]
          rent_price: number | null
          sale_price: number | null
          state: string | null
          status: Database["public"]["Enums"]["property_status"]
          street: string | null
          street_number: string | null
          suites: number | null
          title: string
          total_floors: number | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
          usage: Database["public"]["Enums"]["property_usage"]
          year_built: number | null
        }
        Insert: {
          accepts_exchange?: boolean
          accepts_pets?: boolean
          address_display?: Database["public"]["Enums"]["address_display"]
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          captured_by?: string | null
          city?: string | null
          code?: string
          complement?: string | null
          condo_fee?: number | null
          condominium_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: string[]
          floor?: number | null
          furnished?: boolean
          id?: string
          imob_score?: number | null
          iptu_yearly?: number | null
          latitude?: number | null
          living_area?: number | null
          longitude?: number | null
          lot_area?: number | null
          neighborhood?: string | null
          organization_id: string
          parking_spaces?: number | null
          postal_code?: string | null
          published_at?: string | null
          published_to_portals?: boolean
          purpose: Database["public"]["Enums"]["listing_purpose"]
          rent_price?: number | null
          sale_price?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          street?: string | null
          street_number?: string | null
          suites?: number | null
          title: string
          total_floors?: number | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          usage?: Database["public"]["Enums"]["property_usage"]
          year_built?: number | null
        }
        Update: {
          accepts_exchange?: boolean
          accepts_pets?: boolean
          address_display?: Database["public"]["Enums"]["address_display"]
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          captured_by?: string | null
          city?: string | null
          code?: string
          complement?: string | null
          condo_fee?: number | null
          condominium_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: string[]
          floor?: number | null
          furnished?: boolean
          id?: string
          imob_score?: number | null
          iptu_yearly?: number | null
          latitude?: number | null
          living_area?: number | null
          longitude?: number | null
          lot_area?: number | null
          neighborhood?: string | null
          organization_id?: string
          parking_spaces?: number | null
          postal_code?: string | null
          published_at?: string | null
          published_to_portals?: boolean
          purpose?: Database["public"]["Enums"]["listing_purpose"]
          rent_price?: number | null
          sale_price?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          street?: string | null
          street_number?: string | null
          suites?: number | null
          title?: string
          total_floors?: number | null
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          usage?: Database["public"]["Enums"]["property_usage"]
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_condominium_fkey"
            columns: ["organization_id", "condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          external_url: string | null
          id: string
          is_cover: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          organization_id: string
          position: number
          property_id: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          is_cover?: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          organization_id: string
          position?: number
          property_id: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          is_cover?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          organization_id?: string
          position?: number
          property_id?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_media_property_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      property_owners: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          property_id: string
          share_percent: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          property_id: string
          share_percent?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          property_id?: string
          share_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "property_owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      proposals: {
        Row: {
          amount: number
          broker_id: string | null
          client_id: string
          conditions: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          id: string
          organization_id: string
          payment_terms: string | null
          property_id: string
          purpose: Database["public"]["Enums"]["listing_purpose"]
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          amount: number
          broker_id?: string | null
          client_id: string
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          id?: string
          organization_id: string
          payment_terms?: string | null
          property_id: string
          purpose: Database["public"]["Enums"]["listing_purpose"]
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          broker_id?: string | null
          client_id?: string
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          id?: string
          organization_id?: string
          payment_terms?: string | null
          property_id?: string
          purpose?: Database["public"]["Enums"]["listing_purpose"]
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_property_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          organization_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          property_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          property_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          property_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
    }
    Views: {
      client_property_matches: {
        Row: {
          bedrooms: number | null
          city: string | null
          client_assigned_to: string | null
          client_id: string | null
          client_interest_id: string | null
          client_name: string | null
          imob_score: number | null
          interest_purpose:
            | Database["public"]["Enums"]["listing_purpose"]
            | null
          neighborhood: string | null
          organization_id: string | null
          parking_spaces: number | null
          property_code: string | null
          property_id: string | null
          property_purpose:
            | Database["public"]["Enums"]["listing_purpose"]
            | null
          property_title: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          rent_price: number | null
          sale_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_interests_client_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "client_interests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      apply_referral_recalculation: {
        Args: {
          p_count?: string[]
          p_expected_fingerprint?: string
          p_expected_percent?: number
          p_organization_id?: string
          p_percent?: number
          p_server_key?: string
          p_uncount?: string[]
        }
        Returns: Json
      }
      create_organization: {
        Args: {
          p_city?: string
          p_cnpj?: string
          p_creci?: string
          p_legal_name?: string
          p_name: string
          p_referral_code?: string
          p_slug: string
          p_state?: string
        }
        Returns: string
      }
      dashboard_leads_by_stage: {
        Args: { p_days?: number; p_organization_id: string }
        Returns: {
          stage: Database["public"]["Enums"]["lead_stage"]
          total: number
        }[]
      }
      dashboard_leads_by_week: {
        Args: { p_organization_id: string; p_weeks?: number }
        Returns: {
          source: Database["public"]["Enums"]["lead_source"]
          total: number
          week_start: string
        }[]
      }
      dashboard_properties_by_status: {
        Args: { p_organization_id: string }
        Returns: {
          rent_value: number
          sale_value: number
          status: Database["public"]["Enums"]["property_status"]
          total: number
        }[]
      }
      get_ai_usage_overview: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_billing_account_ids: {
        Args: { p_organization_id?: string; p_server_key?: string }
        Returns: {
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
        }[]
      }
      get_billing_overview: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_feed_settings: { Args: { p_organization_id: string }; Returns: Json }
      get_invitation_preview: { Args: { p_token: string }; Returns: Json }
      get_notification_recipients: {
        Args: {
          p_kind: string
          p_organization_id: string
          p_server_key: string
          p_subject_id: string
        }
        Returns: {
          email: string
          full_name: string
        }[]
      }
      get_portal_feed: {
        Args: { p_org_slug: string; p_token: string }
        Returns: Json
      }
      get_public_landing_page: {
        Args: { p_org_slug: string; p_page_slug: string }
        Returns: Json
      }
      get_public_organization: { Args: { p_slug: string }; Returns: Json }
      get_referral_state: {
        Args: { p_organization_id?: string; p_server_key?: string }
        Returns: Json
      }
      lead_duplicate_flags: {
        Args: { p_lead_ids: string[] }
        Returns: {
          has_duplicate: boolean
          lead_id: string
        }[]
      }
      list_billing_reminders: {
        Args: { p_kind?: string; p_server_key?: string }
        Returns: {
          notice_date: string
          organization_id: string
          organization_name: string
          organization_slug: string
          owner_emails: string[]
        }[]
      }
      list_referral_grace_completions: {
        Args: {
          p_cursor_organization_id?: string
          p_cursor_paid_at?: string
          p_limit?: number
          p_paid_after?: string
          p_paid_until?: string
          p_server_key?: string
        }
        Returns: {
          first_paid_at: string
          referred_organization_id: string
          referrer_organization_id: string
        }[]
      }
      list_referral_referrers: {
        Args: {
          p_after?: string
          p_limit?: number
          p_seed?: string
          p_server_key?: string
        }
        Returns: {
          organization_id: string
          sort_key: string
        }[]
      }
      log_access_event: {
        Args: { p_action?: string; p_entity: string; p_entity_id: string }
        Returns: undefined
      }
      record_billing_invoice_paid: {
        Args: {
          p_amount_paid_cents?: number
          p_invoice_created_at?: string
          p_organization_id?: string
          p_paid_at?: string
          p_plan_net_monthly_cents?: number
          p_server_key?: string
        }
        Returns: boolean
      }
      reserve_ai_usage: {
        Args: {
          p_cache_read_tokens?: number
          p_cache_write_tokens?: number
          p_contact_key?: string
          p_digest?: string
          p_input_tokens?: number
          p_kind?: string
          p_organization_id?: string
          p_output_tokens?: number
          p_server_key?: string
          p_units?: number
          p_user_id?: string
        }
        Returns: Json
      }
      rotate_feed_token: {
        Args: { p_organization_id: string }
        Returns: string
      }
      set_ai_overage_cap: {
        Args: { p_cents: number; p_organization_id: string }
        Returns: number
      }
      set_referral_confirmation_notice: {
        Args: {
          p_claim?: boolean
          p_referred_organization_id?: string
          p_referrer_organization_id?: string
          p_server_key?: string
        }
        Returns: boolean
      }
      set_referral_ineligibility: {
        Args: {
          p_organization_id?: string
          p_reason?: string
          p_server_key?: string
        }
        Returns: boolean
      }
      settle_ai_usage: {
        Args: {
          p_cache_read_tokens?: number
          p_cache_write_tokens?: number
          p_input_tokens?: number
          p_organization_id?: string
          p_output_tokens?: number
          p_reservation_id?: string
          p_response?: string
          p_server_key?: string
          p_status?: string
        }
        Returns: Json
      }
      submit_capture_request: {
        Args: {
          org_slug: string
          p_client_key?: string
          p_nonce?: string
          p_server_key?: string
          payload: Json
        }
        Returns: string
      }
      submit_landing_lead: {
        Args: {
          p_client_key?: string
          p_nonce?: string
          p_org_slug: string
          p_page_slug: string
          p_payload: Json
          p_server_key?: string
        }
        Returns: undefined
      }
      sync_billing_account: {
        Args: {
          p_organization_id?: string
          p_payload?: Json
          p_server_key?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      activity_type:
        | "note"
        | "call"
        | "email"
        | "whatsapp"
        | "visit"
        | "meeting"
        | "status_change"
      address_display: "full" | "street" | "neighborhood"
      app_role:
        | "owner"
        | "manager"
        | "broker"
        | "capturer"
        | "assistant"
        | "finance"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "done"
        | "no_show"
        | "canceled"
      capture_request_status: "new" | "contacted" | "converted" | "discarded"
      client_kind: "pf" | "pj"
      key_status: "available" | "checked_out" | "lost"
      landing_status: "draft" | "published" | "archived"
      landing_template:
        | "campaign_spotlight"
        | "campaign_offer"
        | "campaign_valuation"
        | "launch_showcase"
        | "launch_waitlist"
        | "launch_units"
        | "portfolio_grid"
        | "portfolio_agency"
        | "portfolio_broker"
      lead_source:
        | "landing_page"
        | "portal"
        | "website"
        | "social"
        | "referral"
        | "manual"
        | "other"
      lead_stage:
        | "new"
        | "contacted"
        | "qualified"
        | "visit_scheduled"
        | "proposal"
        | "won"
        | "lost"
      listing_purpose: "sale" | "rent" | "sale_rent"
      media_kind: "image" | "video" | "tour"
      organization_plan: "small" | "medium" | "large"
      property_status:
        | "draft"
        | "active"
        | "reserved"
        | "sold"
        | "rented"
        | "inactive"
      property_type:
        | "apartment"
        | "house"
        | "condo_house"
        | "penthouse"
        | "studio"
        | "flat"
        | "land"
        | "commercial_room"
        | "office"
        | "store"
        | "warehouse"
        | "building"
        | "farm"
        | "ranch"
        | "other"
      property_usage: "residential" | "commercial" | "rural" | "industrial"
      proposal_status:
        | "draft"
        | "sent"
        | "countered"
        | "accepted"
        | "rejected"
        | "withdrawn"
      task_priority: "low" | "medium" | "high"
      task_status: "open" | "done" | "canceled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "note",
        "call",
        "email",
        "whatsapp",
        "visit",
        "meeting",
        "status_change",
      ],
      address_display: ["full", "street", "neighborhood"],
      app_role: [
        "owner",
        "manager",
        "broker",
        "capturer",
        "assistant",
        "finance",
      ],
      appointment_status: [
        "scheduled",
        "confirmed",
        "done",
        "no_show",
        "canceled",
      ],
      capture_request_status: ["new", "contacted", "converted", "discarded"],
      client_kind: ["pf", "pj"],
      key_status: ["available", "checked_out", "lost"],
      landing_status: ["draft", "published", "archived"],
      landing_template: [
        "campaign_spotlight",
        "campaign_offer",
        "campaign_valuation",
        "launch_showcase",
        "launch_waitlist",
        "launch_units",
        "portfolio_grid",
        "portfolio_agency",
        "portfolio_broker",
      ],
      lead_source: [
        "landing_page",
        "portal",
        "website",
        "social",
        "referral",
        "manual",
        "other",
      ],
      lead_stage: [
        "new",
        "contacted",
        "qualified",
        "visit_scheduled",
        "proposal",
        "won",
        "lost",
      ],
      listing_purpose: ["sale", "rent", "sale_rent"],
      media_kind: ["image", "video", "tour"],
      organization_plan: ["small", "medium", "large"],
      property_status: [
        "draft",
        "active",
        "reserved",
        "sold",
        "rented",
        "inactive",
      ],
      property_type: [
        "apartment",
        "house",
        "condo_house",
        "penthouse",
        "studio",
        "flat",
        "land",
        "commercial_room",
        "office",
        "store",
        "warehouse",
        "building",
        "farm",
        "ranch",
        "other",
      ],
      property_usage: ["residential", "commercial", "rural", "industrial"],
      proposal_status: [
        "draft",
        "sent",
        "countered",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      task_priority: ["low", "medium", "high"],
      task_status: ["open", "done", "canceled"],
    },
  },
} as const
