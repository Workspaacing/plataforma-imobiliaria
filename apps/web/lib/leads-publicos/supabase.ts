import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { LandingRpcDatabase } from "@/lib/leads-publicos/rpc-types"
import { getSupabaseEnv, SupabaseNotConfiguredError } from "@/lib/supabase/env"

/**
 * Cliente Supabase anônimo (sem cookies nem sessão) das landing pages. Só chama
 * as RPCs liberadas para `anon`: get_public_landing_page e submit_landing_lead.
 */
export function createLandingAnonClient() {
  const env = getSupabaseEnv()

  if (!env) {
    throw new SupabaseNotConfiguredError()
  }

  return createClient<LandingRpcDatabase>(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
