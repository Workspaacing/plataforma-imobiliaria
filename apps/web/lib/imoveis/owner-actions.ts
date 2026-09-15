"use server"

import { revalidatePath } from "next/cache"

import { CLIENT_KIND_LABELS } from "@workspace/core/properties/enums"

import {
  addOwnerInputSchema,
  ownerShareFormSchema,
  parsePercentInput,
  type AddOwnerInput,
} from "@/components/imoveis/detail/schemas"
import type { OwnerClientOption } from "@/components/imoveis/detail/types"
import type { ActionResult } from "@/lib/auth/action-result"
import { requireMembership } from "@/lib/auth/session"
import { translateDbError } from "@/lib/imoveis/db-errors"
import { isUuid } from "@/lib/imoveis/ids"
import { canDeletePropertyRecords } from "@/lib/imoveis/permissions"
import { getPropertyActionContext, revalidatePropertyPaths } from "@/lib/imoveis/server-context"
import { createClient } from "@/lib/supabase/server"

const SEARCH_LIMIT = 20

/** Remove curingas do LIKE (% _ *) e barra invertida; limita o tamanho. */
function sanitizeSearchTerm(value: unknown) {
  if (typeof value !== "string") return ""
  return value
    .replace(/[%_*\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

function revalidateOwnerPaths(propertyId: string, clientId: string | null) {
  revalidatePropertyPaths(propertyId)
  if (clientId) revalidatePath(`/clientes/${clientId}`)
}

/**
 * Busca de clientes para o combobox de proprietários. O RLS limita ao que o
 * papel enxerga (corretor: os seus e compartilhados; captador: os que criou
 * ou que já são proprietários).
 */
export async function searchClientsForOwnerAction(query: string): Promise<OwnerClientOption[]> {
  const { membership } = await requireMembership()
  const term = sanitizeSearchTerm(query)
  const supabase = await createClient()

  let request = supabase
    .from("clients")
    .select("id, name, kind, trade_name")
    .eq("organization_id", membership.organizationId)
    .order("name")
    .limit(SEARCH_LIMIT)

  if (term) {
    request = request.ilike("name", `%${term}%`)
  }

  const { data, error } = await request

  if (error) return []

  return (data ?? []).map((client) => ({
    id: client.id,
    label: client.name,
    description: [CLIENT_KIND_LABELS[client.kind], client.trade_name].filter(Boolean).join(" · "),
  }))
}

export async function addPropertyOwnerAction(
  propertyId: string,
  input: AddOwnerInput
): Promise<ActionResult> {
  if (!isUuid(propertyId)) {
    return { ok: false, error: "Imóvel inválido." }
  }

  const parsed = addOwnerInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Confira os dados do proprietário.",
    }
  }

  const loaded = await getPropertyActionContext(propertyId)
  if (!loaded.ok) return loaded

  const { supabase, organizationId, property } = loaded.context
  const { clientId, sharePercent } = parsed.data

  // O FK aceitaria qualquer cliente da imobiliária; exigimos que o papel o enxergue.
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle()

  if (clientError) {
    return {
      ok: false,
      error: translateDbError(clientError, "adicionar o proprietário"),
    }
  }
  if (!client) {
    return {
      ok: false,
      error: "Cliente não encontrado ou fora do seu acesso nesta imobiliária.",
    }
  }

  const { data, error } = await supabase
    .from("property_owners")
    .insert({
      organization_id: organizationId,
      property_id: property.id,
      client_id: clientId,
      share_percent: parsePercentInput(sharePercent),
    })
    .select("id")

  if (error) {
    return {
      ok: false,
      error: translateDbError(error, "adicionar o proprietário"),
    }
  }
  if (!data?.length) {
    return {
      ok: false,
      error: "Você não tem permissão para adicionar proprietários a este imóvel.",
    }
  }

  revalidateOwnerPaths(property.id, clientId)

  return { ok: true, message: "Proprietário adicionado." }
}

export async function updatePropertyOwnerShareAction(
  propertyId: string,
  ownerId: string,
  sharePercent: string
): Promise<ActionResult> {
  if (!isUuid(propertyId) || !isUuid(ownerId)) {
    return { ok: false, error: "Proprietário inválido." }
  }

  const parsed = ownerShareFormSchema.safeParse({ sharePercent })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Participação inválida.",
    }
  }

  const loaded = await getPropertyActionContext(propertyId)
  if (!loaded.ok) return loaded

  const { supabase, organizationId, property } = loaded.context

  const { data, error } = await supabase
    .from("property_owners")
    .update({ share_percent: parsePercentInput(parsed.data.sharePercent) })
    .eq("organization_id", organizationId)
    .eq("property_id", property.id)
    .eq("id", ownerId)
    .select("id, client_id")

  if (error) {
    return {
      ok: false,
      error: translateDbError(error, "alterar a participação"),
    }
  }

  const row = data?.[0]
  if (!row) {
    return {
      ok: false,
      error: "Você não tem permissão para alterar este proprietário ou ele foi removido.",
    }
  }

  revalidateOwnerPaths(property.id, row.client_id)

  return { ok: true, message: "Participação atualizada." }
}

export async function removePropertyOwnerAction(
  propertyId: string,
  ownerId: string
): Promise<ActionResult> {
  if (!isUuid(propertyId) || !isUuid(ownerId)) {
    return { ok: false, error: "Proprietário inválido." }
  }

  const loaded = await getPropertyActionContext(propertyId, {
    requireEdit: false,
  })
  if (!loaded.ok) return loaded

  const { supabase, organizationId, role, property } = loaded.context

  if (!canDeletePropertyRecords(role)) {
    return {
      ok: false,
      error: "Somente o dono ou o gerente podem remover proprietários.",
    }
  }

  const { data, error } = await supabase
    .from("property_owners")
    .delete()
    .eq("organization_id", organizationId)
    .eq("property_id", property.id)
    .eq("id", ownerId)
    .select("id, client_id")

  if (error) {
    return {
      ok: false,
      error: translateDbError(error, "remover o proprietário"),
    }
  }

  const row = data?.[0]
  if (!row) {
    return {
      ok: false,
      error: "Você não tem permissão para remover este proprietário ou ele já foi removido.",
    }
  }

  revalidateOwnerPaths(property.id, row.client_id)

  return { ok: true, message: "Proprietário removido." }
}
