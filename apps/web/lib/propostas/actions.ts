"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  LISTING_PURPOSE_LABELS,
  PROPOSAL_STATUS_VALUES,
} from "@workspace/core/properties/enums"

import type { ActionResult } from "@/lib/auth/action-result"
import { requireMembership } from "@/lib/auth/session"
import { translateDbError } from "@/lib/propostas/db-errors"
import { parseBrlInput } from "@/lib/propostas/money"
import {
  canEditProperty,
  COMMERCIAL_ROLES,
  isSelfBrokerRole,
} from "@/lib/propostas/permissions"
import {
  proposalFormSchema,
  proposalIdSchema,
  type ProposalFormValues,
} from "@/lib/propostas/schemas"
import {
  canTransition,
  getTransitionCopy,
  isDecisionStatus,
  OPEN_PROPOSAL_STATUSES,
  type ProposalStatus,
} from "@/lib/propostas/status"
import { createClient } from "@/lib/supabase/server"

function revalidateProposals() {
  revalidatePath("/propostas")
  revalidatePath("/imoveis", "layout")
}

const NO_UPDATE_PERMISSION =
  "Você não tem permissão para alterar esta proposta. Só o corretor da proposta ou quem edita o imóvel pode fazer isso."

type ServerClient = Awaited<ReturnType<typeof createClient>>

/** Confere se o imóvel existe e aceita a finalidade da proposta. */
async function checkPropertyPurpose(
  supabase: ServerClient,
  organizationId: string,
  values: ProposalFormValues
): Promise<string | null> {
  const { data: property, error } = await supabase
    .from("properties")
    .select("id, purpose")
    .eq("id", values.propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) return translateDbError(error, "Você não tem acesso a este imóvel.")
  if (!property) return "Imóvel não encontrado. Recarregue a página."

  if (property.purpose !== "sale_rent" && property.purpose !== values.purpose) {
    return `Este imóvel está anunciado só para ${LISTING_PURPOSE_LABELS[property.purpose].toLowerCase()}.`
  }

  return null
}

function toProposalColumns(values: ProposalFormValues) {
  return {
    property_id: values.propertyId,
    client_id: values.clientId,
    broker_id: values.brokerId || null,
    purpose: values.purpose,
    amount: parseBrlInput(values.amount) ?? 0,
    payment_terms: values.paymentTerms || null,
    conditions: values.conditions || null,
    valid_until: values.validUntil || null,
  }
}

export async function createProposal(values: ProposalFormValues): Promise<ActionResult> {
  const parsed = proposalFormSchema.safeParse(values)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos." }
  }

  const { user, membership } = await requireMembership()

  if (!COMMERCIAL_ROLES.includes(membership.role)) {
    return { ok: false, error: "Você não tem permissão para criar propostas." }
  }

  // Corretor/captador só cria proposta em imóvel que não edita se for o corretor
  // dela (política de INSERT): sem corretor informado, fica o próprio usuário.
  const proposal: ProposalFormValues =
    isSelfBrokerRole(membership.role) && !parsed.data.brokerId
      ? { ...parsed.data, brokerId: user.id }
      : parsed.data

  const supabase = await createClient()
  const purposeError = await checkPropertyPurpose(supabase, membership.organizationId, proposal)

  if (purposeError) return { ok: false, error: purposeError }

  const { error } = await supabase.from("proposals").insert({
    organization_id: membership.organizationId,
    status: "draft",
    ...toProposalColumns(proposal),
  })

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23503"
          ? "Imóvel ou cliente não encontrado. Recarregue a página."
          : translateDbError(
              error,
              "Você não tem permissão para criar propostas para este cliente."
            ),
    }
  }

  revalidateProposals()
  return { ok: true, message: "Proposta criada como rascunho." }
}

export async function updateProposal(
  proposalId: string,
  values: ProposalFormValues
): Promise<ActionResult> {
  const id = proposalIdSchema.safeParse(proposalId)
  const parsed = proposalFormSchema.safeParse(values)

  if (!id.success) return { ok: false, error: "Proposta inválida." }
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos." }
  }

  const { membership } = await requireMembership()
  const supabase = await createClient()

  const { data: current, error: currentError } = await supabase
    .from("proposals")
    .select("status")
    .eq("id", id.data)
    .eq("organization_id", membership.organizationId)
    .maybeSingle()

  if (currentError) return { ok: false, error: translateDbError(currentError, NO_UPDATE_PERMISSION) }
  if (!current) return { ok: false, error: "Proposta não encontrada. Recarregue a página." }

  if (!OPEN_PROPOSAL_STATUSES.includes(current.status)) {
    return { ok: false, error: "Propostas encerradas não podem ser editadas." }
  }

  const purposeError = await checkPropertyPurpose(supabase, membership.organizationId, parsed.data)

  if (purposeError) return { ok: false, error: purposeError }

  const { data, error } = await supabase
    .from("proposals")
    .update(toProposalColumns(parsed.data))
    .eq("id", id.data)
    .eq("organization_id", membership.organizationId)
    .in("status", [...OPEN_PROPOSAL_STATUSES])
    .select("id")

  if (error) return { ok: false, error: translateDbError(error, NO_UPDATE_PERMISSION) }
  if (data.length === 0) return { ok: false, error: NO_UPDATE_PERMISSION }

  revalidateProposals()
  return { ok: true, message: "Proposta atualizada." }
}

export type ProposalStatusResult =
  | {
      ok: true
      message: string
      /** Ao aceitar: oferece reservar o imóvel, se o usuário puder editá-lo. */
      reserveOffer: { propertyId: string; propertyLabel: string } | null
    }
  | { ok: false; error: string }

const statusSchema = z.enum(PROPOSAL_STATUS_VALUES as [ProposalStatus, ...ProposalStatus[]])

const RESERVABLE_PROPERTY_STATUSES = ["draft", "active", "inactive"]

export async function changeProposalStatus(
  proposalId: string,
  nextStatus: ProposalStatus
): Promise<ProposalStatusResult> {
  const id = proposalIdSchema.safeParse(proposalId)
  const target = statusSchema.safeParse(nextStatus)

  if (!id.success || !target.success) return { ok: false, error: "Status inválido." }

  const { user, membership } = await requireMembership()
  const supabase = await createClient()

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(
      "id, status, property:properties!proposals_property_fkey(id, code, title, status, captured_by, broker_id)"
    )
    .eq("id", id.data)
    .eq("organization_id", membership.organizationId)
    .maybeSingle()

  if (loadError) return { ok: false, error: translateDbError(loadError, NO_UPDATE_PERMISSION) }
  if (!proposal) return { ok: false, error: "Proposta não encontrada. Recarregue a página." }

  if (!canTransition(proposal.status, target.data)) {
    return { ok: false, error: "Esta mudança de status não é permitida para a proposta." }
  }

  const { data, error } = await supabase
    .from("proposals")
    .update({
      status: target.data,
      decided_at: isDecisionStatus(target.data) ? new Date().toISOString() : null,
    })
    .eq("id", id.data)
    .eq("organization_id", membership.organizationId)
    .eq("status", proposal.status)
    .select("id")

  if (error) return { ok: false, error: translateDbError(error, NO_UPDATE_PERMISSION) }

  if (data.length === 0) {
    const { data: latest } = await supabase
      .from("proposals")
      .select("status")
      .eq("id", id.data)
      .maybeSingle()

    return {
      ok: false,
      error:
        latest && latest.status !== proposal.status
          ? "A proposta foi alterada por outra pessoa. Recarregue a página."
          : NO_UPDATE_PERMISSION,
    }
  }

  const property = proposal.property
  const reserveOffer =
    target.data === "accepted" &&
    property &&
    RESERVABLE_PROPERTY_STATUSES.includes(property.status) &&
    canEditProperty(membership.role, user.id, {
      capturedBy: property.captured_by,
      brokerId: property.broker_id,
    })
      ? { propertyId: property.id, propertyLabel: `${property.code} · ${property.title}` }
      : null

  revalidateProposals()
  return {
    ok: true,
    message: getTransitionCopy(proposal.status, target.data).success,
    reserveOffer,
  }
}

export async function reserveProperty(propertyId: string): Promise<ActionResult> {
  const id = z.guid().safeParse(propertyId)

  if (!id.success) return { ok: false, error: "Imóvel inválido." }

  const { membership } = await requireMembership()
  const supabase = await createClient()
  const noPermission = "Você não tem permissão para editar este imóvel."

  const { data: property, error: loadError } = await supabase
    .from("properties")
    .select("status")
    .eq("id", id.data)
    .eq("organization_id", membership.organizationId)
    .maybeSingle()

  if (loadError) return { ok: false, error: translateDbError(loadError, noPermission) }
  if (!property) return { ok: false, error: "Imóvel não encontrado." }
  if (property.status === "reserved") return { ok: true, message: "O imóvel já estava reservado." }

  if (!RESERVABLE_PROPERTY_STATUSES.includes(property.status)) {
    return { ok: false, error: "Este imóvel já foi vendido ou alugado." }
  }

  const { data, error } = await supabase
    .from("properties")
    .update({ status: "reserved" })
    .eq("id", id.data)
    .eq("organization_id", membership.organizationId)
    .select("id")

  if (error) return { ok: false, error: translateDbError(error, noPermission) }
  if (data.length === 0) return { ok: false, error: noPermission }

  revalidateProposals()
  revalidatePath("/painel")
  return { ok: true, message: "Imóvel marcado como reservado." }
}
