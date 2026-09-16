import "server-only"

import { getOrganizationMembers } from "@/lib/clientes/members"
import { getMemberName, type MemberOption } from "@/lib/clientes/options"
import type { LeadsServerClient } from "@/lib/leads/db"
import type {
  LeadAssignmentHistoryEvent,
  LeadHistoryEvent,
  LeadStageHistoryEvent,
} from "@/lib/leads/types"

/**
 * Linha do tempo do lead: `public.lead_stage_events` (mudanças de etapa) e
 * `public.lead_assignment_events` (trocas de responsável), da migração
 * `lead_roulette_sla`. Só leitura — quem escreve é o trigger
 * `private.leads_log_events`; o RLS libera para quem já pode ver o lead.
 *
 * Falha não derruba o detalhe do lead: a tela mostra o aviso e segue.
 */

/** Teto por tabela (a fila de eventos de um lead raramente passa disso). */
const LEAD_HISTORY_LIMIT = 200

/**
 * Motivos gravados pelo banco em `app.lead_event_reason`. Os de atribuição
 * estão no CHECK de `lead_assignment_events`; os de etapa são o canal de
 * entrada ('created'/'landing_page') ou nulos nas mudanças feitas pelo app.
 */
const LEAD_EVENT_REASON_LABELS: Record<string, string> = {
  created: "Cadastro manual",
  manual: "Atribuição manual",
  claim: "Corretor assumiu",
  roulette: "Distribuído pelo rodízio",
  landing_page: "Veio da landing page",
  sla_reassign: "Redistribuído por estouro do prazo",
  sla_queued: "Na fila da próxima janela de plantão",
  bulk_transfer: "Transferência em massa",
  bulk_release: "Liberação em massa",
  member_removed: "Membro saiu da equipe",
}

function reasonLabel(reason: string | null | undefined) {
  if (!reason) return null
  return LEAD_EVENT_REASON_LABELS[reason] ?? null
}

/** Nome de quem agiu; sem autor é o próprio banco (rodízio, cron do SLA). */
function actorName(members: readonly MemberOption[], userId: string | null) {
  return getMemberName(members, userId, "Sistema")
}

export type LeadHistoryResult = {
  events: LeadHistoryEvent[]
  failed: boolean
}

export async function getLeadHistory(
  supabase: LeadsServerClient,
  organizationId: string,
  leadId: string
): Promise<LeadHistoryResult> {
  const [stageResult, assignmentResult, members] = await Promise.all([
    supabase
      .from("lead_stage_events")
      .select("id, from_stage, to_stage, changed_by, reason, created_at")
      .eq("organization_id", organizationId)
      .eq("lead_id", leadId)
      .order("created_at")
      .order("id")
      .limit(LEAD_HISTORY_LIMIT),
    supabase
      .from("lead_assignment_events")
      .select("id, from_user_id, to_user_id, changed_by, reason, created_at")
      .eq("organization_id", organizationId)
      .eq("lead_id", leadId)
      .order("created_at")
      .order("id")
      .limit(LEAD_HISTORY_LIMIT),
    getOrganizationMembers(organizationId),
  ])

  if (stageResult.error || assignmentResult.error) {
    console.error(
      "[leads] falha ao carregar o histórico do lead:",
      stageResult.error?.code ?? assignmentResult.error?.code ?? "erro"
    )
    return { events: [], failed: true }
  }

  const stageEvents = stageResult.data.map((row): LeadStageHistoryEvent => ({
    kind: "stage",
    id: String(row.id),
    at: row.created_at,
    actorName: actorName(members, row.changed_by),
    reasonLabel: reasonLabel(row.reason),
    fromStage: row.from_stage,
    toStage: row.to_stage,
  }))

  const assignmentEvents = assignmentResult.data.map((row): LeadAssignmentHistoryEvent => ({
    kind: "assignment",
    id: String(row.id),
    at: row.created_at,
    actorName: actorName(members, row.changed_by),
    reasonLabel: reasonLabel(row.reason) ?? "Atribuição manual",
    fromName: row.from_user_id ? getMemberName(members, row.from_user_id) : null,
    toName: row.to_user_id ? getMemberName(members, row.to_user_id) : null,
  }))

  // Criação grava etapa e atribuição no mesmo instante: a etapa vem primeiro,
  // que é a ordem em que o trigger escreve e a que se lê melhor.
  const events = [...stageEvents, ...assignmentEvents].sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? -1 : 1
    if (a.kind !== b.kind) return a.kind === "stage" ? -1 : 1
    return Number(a.id) - Number(b.id)
  })

  return { events, failed: false }
}
