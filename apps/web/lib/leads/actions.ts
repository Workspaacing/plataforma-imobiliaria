"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { ActionResult } from "@/lib/auth/action-result"
import { requireMembership } from "@/lib/auth/session"
import {
  INVALID_FIELDS_MESSAGE,
  toFieldErrors,
  type ActionResultWithData,
} from "@/lib/clientes/action-result"
import { permissionDeniedMessage, translateDatabaseError } from "@/lib/clientes/db-errors"
import { LEAD_STAGE_LABELS, LEADS_PATH } from "@/lib/leads/constants"
import { createLeadsClient, type LeadsServerClient } from "@/lib/leads/db"
import type { LeadUpdate } from "@/lib/leads/db-types"
import {
  canChooseLeadAssignee,
  canCreateLeads,
  canDeleteLeads,
  canWorkLeads,
} from "@/lib/leads/permissions"
import { getLeadDetailExtras } from "@/lib/leads/queries"
import {
  leadIdSchema,
  moveLeadSchema,
  newLeadFormSchema,
  toLeadInsertRow,
  type MoveLeadInput,
  type NewLeadFormValues,
} from "@/lib/leads/schemas"
import type { LeadDetailExtras } from "@/lib/leads/types"

const RENUMBER_BATCH_SIZE = 25

function revalidateLeads(leadId?: string) {
  revalidatePath(LEADS_PATH)

  if (leadId) {
    revalidatePath(`${LEADS_PATH}/${leadId}`)
  }
}

async function isActiveMember(supabase: LeadsServerClient, organizationId: string, userId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()

  return Boolean(data)
}

/** Registra no histórico do cliente (quando o lead já foi convertido). Falha não bloqueia. */
async function logClientActivity(
  supabase: LeadsServerClient,
  organizationId: string,
  clientId: string,
  body: string
) {
  const { error } = await supabase.from("activities").insert({
    organization_id: organizationId,
    client_id: clientId,
    type: "status_change",
    body,
  })

  if (error) {
    console.error("[leads] histórico do cliente não registrado:", error.code ?? "erro")
  }
}

// -----------------------------------------------------------------------------
// Novo lead manual
// -----------------------------------------------------------------------------

export async function createLead(
  values: NewLeadFormValues
): Promise<ActionResultWithData<{ id: string }>> {
  const parsed = newLeadFormSchema.safeParse(values)

  if (!parsed.success) {
    return {
      ok: false,
      error: INVALID_FIELDS_MESSAGE,
      fieldErrors: toFieldErrors(parsed.error),
    }
  }

  const { user, membership } = await requireMembership()
  const action = "cadastrar leads"

  if (!canCreateLeads(membership.role)) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  const supabase = await createLeadsClient()
  const assignedTo = parsed.data.assignedTo || null

  if (assignedTo && !canChooseLeadAssignee(membership.role) && assignedTo !== user.id) {
    const message = "Corretores cadastram leads para si mesmos ou sem responsável."
    return { ok: false, error: message, fieldErrors: { assignedTo: message } }
  }

  if (assignedTo && !(await isActiveMember(supabase, membership.organizationId, assignedTo))) {
    const message = "O responsável precisa ser um membro ativo da imobiliária."
    return { ok: false, error: message, fieldErrors: { assignedTo: message } }
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...toLeadInsertRow(parsed.data),
      organization_id: membership.organizationId,
      assigned_to: assignedTo,
    })
    .select("id")
    .single()

  if (error) {
    // CHECK `leads_consent_at_not_future`: mensagem do banco já em pt-BR.
    if (error.code === "23514" && error.message.toLowerCase().includes("consentimento")) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: { consentDate: error.message },
      }
    }

    return { ok: false, error: translateDatabaseError(error, action) }
  }

  revalidateLeads()

  return { ok: true, data: { id: data.id }, message: "Lead cadastrado." }
}

// -----------------------------------------------------------------------------
// Etapa e ordem
// -----------------------------------------------------------------------------

export async function moveLead(input: MoveLeadInput): Promise<ActionResult> {
  const parsed = moveLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Movimentação inválida.",
    }
  }

  const { membership } = await requireMembership()
  const action = "mover este lead"

  if (!canWorkLeads(membership.role)) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  const { leadId, stage, position, lostReason, renumber } = parsed.data
  const supabase = await createLeadsClient()

  const { data: current, error: loadError } = await supabase
    .from("leads")
    .select("id, stage, last_contact_at, client_id")
    .eq("id", leadId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle()

  if (loadError) {
    return { ok: false, error: translateDatabaseError(loadError, action) }
  }

  if (!current) {
    return {
      ok: false,
      error: "Lead não encontrado. Ele pode ter sido removido.",
    }
  }

  const patch: LeadUpdate = { stage }

  if (position !== null) {
    patch.position = position
  }

  if (stage === "lost") {
    patch.lost_reason = lostReason?.trim() ?? null
  } else if (current.stage === "lost") {
    patch.lost_reason = null
  }

  // "Em contato" registra o contato agora; sair de "Novo" sem contato também conta.
  if (
    (stage === "contacted" && current.stage !== "contacted") ||
    (current.stage === "new" && stage !== "new" && !current.last_contact_at)
  ) {
    patch.last_contact_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .eq("organization_id", membership.organizationId)
    .select("id")

  if (error) {
    return { ok: false, error: translateDatabaseError(error, action) }
  }

  if (data.length === 0) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  const others = renumber.filter((item) => item.id !== leadId)
  let renumberFailures = 0

  for (let index = 0; index < others.length; index += RENUMBER_BATCH_SIZE) {
    const results = await Promise.all(
      others
        .slice(index, index + RENUMBER_BATCH_SIZE)
        .map((item) =>
          supabase
            .from("leads")
            .update({ position: item.position })
            .eq("id", item.id)
            .eq("organization_id", membership.organizationId)
            .select("id")
        )
    )

    renumberFailures += results.filter((result) => result.error || result.data?.length === 0).length
  }

  if (renumberFailures > 0) {
    console.error(`[leads] ${renumberFailures} posição(ões) não renumerada(s) na coluna.`)
  }

  const stageChanged = current.stage !== stage

  if (stageChanged && current.client_id) {
    const reason = stage === "lost" && lostReason ? ` Motivo: ${lostReason.trim()}` : ""
    await logClientActivity(
      supabase,
      membership.organizationId,
      current.client_id,
      `Etapa do lead: ${LEAD_STAGE_LABELS[current.stage]} → ${LEAD_STAGE_LABELS[stage]}.${reason}`
    )
  }

  revalidateLeads(leadId)

  return {
    ok: true,
    message: stageChanged ? `Lead movido para ${LEAD_STAGE_LABELS[stage]}.` : "Ordem atualizada.",
  }
}

// -----------------------------------------------------------------------------
// Responsável
// -----------------------------------------------------------------------------

/** Gestão atribui a qualquer membro (ou remove); corretor só assume lead sem responsável. */
export async function assignLead(leadId: string, assigneeId: string | null): Promise<ActionResult> {
  if (
    !leadIdSchema.safeParse(leadId).success ||
    (assigneeId && !z.guid().safeParse(assigneeId).success)
  ) {
    return { ok: false, error: "Responsável inválido." }
  }

  const { user, membership } = await requireMembership()
  const role = membership.role
  const action = "alterar o responsável deste lead"

  if (!canWorkLeads(role)) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  const isClaim = !canChooseLeadAssignee(role)

  if (isClaim && assigneeId !== user.id) {
    return {
      ok: false,
      error: "Corretores só podem assumir leads sem responsável.",
    }
  }

  const supabase = await createLeadsClient()

  if (assigneeId && !(await isActiveMember(supabase, membership.organizationId, assigneeId))) {
    return {
      ok: false,
      error: "O responsável precisa ser um membro ativo da imobiliária.",
    }
  }

  let query = supabase
    .from("leads")
    .update({ assigned_to: assigneeId })
    .eq("id", leadId)
    .eq("organization_id", membership.organizationId)

  if (isClaim) {
    query = query.is("assigned_to", null)
  }

  const { data, error } = await query.select("id")

  if (error) {
    return { ok: false, error: translateDatabaseError(error, action) }
  }

  if (data.length === 0) {
    return {
      ok: false,
      error: isClaim
        ? "Este lead já tem responsável. Recarregue a página."
        : permissionDeniedMessage(action),
    }
  }

  revalidateLeads(leadId)

  return {
    ok: true,
    message: isClaim
      ? "Lead assumido."
      : assigneeId
        ? "Responsável atualizado."
        : "Lead sem responsável.",
  }
}

// -----------------------------------------------------------------------------
// Contato
// -----------------------------------------------------------------------------

/** Registra que houve contato agora; lead em "Novo" passa para "Em contato". */
export async function markLeadContacted(leadId: string): Promise<ActionResult> {
  if (!leadIdSchema.safeParse(leadId).success) {
    return { ok: false, error: "Lead inválido." }
  }

  const { membership } = await requireMembership()
  const action = "registrar contato neste lead"

  if (!canWorkLeads(membership.role)) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  const supabase = await createLeadsClient()
  const { data: current, error: loadError } = await supabase
    .from("leads")
    .select("stage")
    .eq("id", leadId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle()

  if (loadError) {
    return { ok: false, error: translateDatabaseError(loadError, action) }
  }

  if (!current) {
    return {
      ok: false,
      error: "Lead não encontrado. Ele pode ter sido removido.",
    }
  }

  const patch: LeadUpdate = { last_contact_at: new Date().toISOString() }

  if (current.stage === "new") {
    patch.stage = "contacted"
  }

  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .eq("organization_id", membership.organizationId)
    .select("id")

  if (error) {
    return { ok: false, error: translateDatabaseError(error, action) }
  }

  if (data.length === 0) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  revalidateLeads(leadId)

  return {
    ok: true,
    message: patch.stage
      ? "Contato registrado. Lead movido para Em contato."
      : "Contato registrado.",
  }
}

// -----------------------------------------------------------------------------
// Exclusão (LGPD: eliminação)
// -----------------------------------------------------------------------------

export async function deleteLead(leadId: string): Promise<ActionResult> {
  if (!leadIdSchema.safeParse(leadId).success) {
    return { ok: false, error: "Lead inválido." }
  }

  const { membership } = await requireMembership()
  const action = "excluir leads"

  if (!canDeleteLeads(membership.role)) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  const supabase = await createLeadsClient()
  const { data, error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId)
    .eq("organization_id", membership.organizationId)
    .select("id")

  if (error) {
    return { ok: false, error: translateDatabaseError(error, action) }
  }

  if (data.length === 0) {
    return { ok: false, error: permissionDeniedMessage(action) }
  }

  revalidateLeads()

  return { ok: true, message: "Lead excluído." }
}

// -----------------------------------------------------------------------------
// Leitura sob demanda (painel lateral)
// -----------------------------------------------------------------------------

/** Cliente vinculado e histórico, carregados quando o painel do lead abre. */
export async function loadLeadDetailExtras(
  leadId: string
): Promise<ActionResultWithData<LeadDetailExtras>> {
  if (!leadIdSchema.safeParse(leadId).success) {
    return { ok: false, error: "Lead inválido." }
  }

  const { membership } = await requireMembership()
  const supabase = await createLeadsClient()

  const { data: lead, error } = await supabase
    .from("leads")
    .select("client_id")
    .eq("id", leadId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: translateDatabaseError(error, "ver este lead") }
  }

  if (!lead) {
    return {
      ok: false,
      error: "Lead não encontrado. Ele pode ter sido removido.",
    }
  }

  return {
    ok: true,
    data: await getLeadDetailExtras(supabase, membership.organizationId, lead.client_id),
  }
}

// -----------------------------------------------------------------------------
// Registro de acesso (LGPD: quem viu o quê)
// -----------------------------------------------------------------------------

/**
 * Registra a abertura do detalhe do lead (LGPD). Falha não bloqueia a tela.
 *
 * `public.log_access_event` aceita `p_entity` em ('lead', 'leads') desde a
 * migração `landing_pages_and_leads_followup`; grava sempre como `leads`
 * (mesmo nome usado pelo trigger de auditoria) e exige que o usuário possa
 * ver o lead (senão `P0002`). Segue o padrão de `logClientView`
 * (lib/clientes/actions.ts).
 */
export async function logLeadView(leadId: string): Promise<void> {
  if (!leadIdSchema.safeParse(leadId).success) {
    return
  }

  await requireMembership()

  const supabase = await createLeadsClient()
  const { error } = await supabase.rpc("log_access_event", {
    p_entity: "leads",
    p_entity_id: leadId,
    p_action: "view",
  })

  if (error) {
    console.error("[leads] falha ao registrar acesso ao lead:", error.code ?? "erro")
  }
}
