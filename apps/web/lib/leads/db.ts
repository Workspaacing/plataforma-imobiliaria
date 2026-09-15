import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { LeadsDatabase } from "@/lib/leads/db-types"
import { createClient } from "@/lib/supabase/server"

/**
 * Cliente Supabase da requisição com as tabelas do funil tipadas.
 * TODO: trocar pelos tipos gerados — quando `leads` e `landing_pages` estiverem
 * em @workspace/database/types, use `createClient()` diretamente.
 */
export async function createLeadsClient() {
  const supabase = await createClient()
  return supabase as unknown as SupabaseClient<LeadsDatabase>
}

export type LeadsServerClient = Awaited<ReturnType<typeof createLeadsClient>>
