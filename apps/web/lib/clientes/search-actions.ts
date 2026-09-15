"use server"

import { CLIENT_KIND_LABELS } from "@workspace/core/properties/enums"

import { requireMembership } from "@/lib/auth/session"
import type { ClientOption } from "@/lib/clientes/options"
import { buildClientSearchFilter, sanitizeSearchTerm } from "@/lib/clientes/search"
import { createClient } from "@/lib/supabase/server"

/**
 * Opções para o combobox de clientes. O RLS limita aos clientes que o usuário
 * pode ver (corretor: os seus e compartilhados).
 */
export async function searchClientOptions(query: string): Promise<ClientOption[]> {
  const { membership } = await requireMembership()
  const term = sanitizeSearchTerm(query)
  const supabase = await createClient()

  let request = supabase
    .from("clients")
    .select("id, name, kind, trade_name")
    .eq("organization_id", membership.organizationId)
    .order("name")
    .limit(20)

  if (term) {
    request = request.or(buildClientSearchFilter(term))
  }

  const { data, error } = await request

  if (error) {
    return []
  }

  return data.map((client) => ({
    id: client.id,
    label: client.name,
    description: [CLIENT_KIND_LABELS[client.kind], client.trade_name]
      .filter(Boolean)
      .join(" · "),
  }))
}
