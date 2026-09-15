import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@workspace/database/types"

import { getSupabaseEnv, SupabaseNotConfiguredError } from "@/lib/supabase/env"

/**
 * Cliente Supabase para Client Components. Para autorização, confie sempre
 * no servidor (getClaims/getUser em Server Components e Server Actions).
 */
export function createClient() {
  const env = getSupabaseEnv()

  if (!env) {
    throw new SupabaseNotConfiguredError()
  }

  return createBrowserClient<Database>(env.url, env.publishableKey)
}
