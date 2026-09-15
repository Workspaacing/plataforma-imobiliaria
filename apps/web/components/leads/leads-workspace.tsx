"use client"

import * as React from "react"

import { KanbanBoard } from "@/components/leads/kanban-board"
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet"
import { LeadsTable } from "@/components/leads/leads-table"
import { LostReasonDialog } from "@/components/leads/lost-reason-dialog"
import { useLeadMutations } from "@/components/leads/use-lead-mutations"
import { useNow } from "@/components/leads/use-now"
import type { Role } from "@/lib/auth/roles"
import type { MemberOption } from "@/lib/clientes/options"
import { loadLeadDetailExtras } from "@/lib/leads/actions"
import type { LeadView } from "@/lib/leads/filters"
import { EMPTY_LEAD_DETAIL_EXTRAS, type LeadDetailExtras, type LeadItem } from "@/lib/leads/types"

type ExtrasState = {
  leadId: string
  data: LeadDetailExtras | null
  error: string | null
}

type LeadsWorkspaceProps = {
  leads: LeadItem[]
  members: MemberOption[]
  currentUserId: string
  role: Role
  nowMs: number
  view: LeadView
}

/** Quadro ou lista, painel de detalhe e diálogo de perda, sobre o mesmo estado otimista. */
export function LeadsWorkspace({ leads, members, currentUserId, role, nowMs, view }: LeadsWorkspaceProps) {
  const now = useNow(nowMs)
  const mutations = useLeadMutations(leads, { managePositions: true })
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [extras, setExtras] = React.useState<ExtrasState | null>(null)
  const [, startLoadingExtras] = React.useTransition()
  const requestRef = React.useRef(0)

  const selectedLead = selectedId
    ? (mutations.leads.find((lead) => lead.id === selectedId) ?? null)
    : null
  const selectedExtras = extras && extras.leadId === selectedId ? extras : null

  /** Cliente vinculado e histórico; sem cliente não há o que buscar (a menos que `force`). */
  function loadExtras(leadId: string, clientId: string | null, force = false) {
    const requestId = ++requestRef.current

    if (!clientId && !force) {
      setExtras({ leadId, data: EMPTY_LEAD_DETAIL_EXTRAS, error: null })
      return
    }

    setExtras((current) =>
      current?.leadId === leadId && current.data ? current : { leadId, data: null, error: null }
    )

    startLoadingExtras(async () => {
      const result = await loadLeadDetailExtras(leadId)

      if (requestId !== requestRef.current) return

      setExtras(
        result.ok
          ? { leadId, data: result.data, error: null }
          : { leadId, data: null, error: result.error }
      )
    })
  }

  function openLead(leadId: string) {
    const lead = mutations.leads.find((item) => item.id === leadId)

    if (!lead) return

    setSelectedId(leadId)
    loadExtras(leadId, lead.clientId)
  }

  return (
    <>
      {view === "lista" ? (
        <LeadsTable
          leads={mutations.leads}
          members={members}
          nowMs={now}
          currentUserId={currentUserId}
          role={role}
          onOpenLead={openLead}
          onMoveLead={mutations.moveLead}
        />
      ) : (
        <KanbanBoard
          leads={mutations.leads}
          members={members}
          nowMs={now}
          currentUserId={currentUserId}
          role={role}
          onOpenLead={openLead}
          onMoveLead={mutations.moveLead}
        />
      )}

      <LeadDetailSheet
        lead={selectedLead}
        open={selectedLead !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        members={members}
        currentUserId={currentUserId}
        role={role}
        nowMs={now}
        extras={selectedExtras?.data ?? null}
        extrasError={selectedExtras?.error ?? null}
        isPending={mutations.isPending}
        onStageChange={(stage) => {
          if (selectedLead) mutations.moveLead(selectedLead.id, stage, null)
        }}
        onAssign={(assigneeId) => {
          if (selectedLead) mutations.assignLead(selectedLead.id, assigneeId)
        }}
        onMarkContacted={() => {
          if (selectedLead) mutations.markContacted(selectedLead.id)
        }}
        onConverted={() => {
          if (selectedLead) loadExtras(selectedLead.id, null, true)
        }}
        onActivityAdded={() => {
          if (selectedLead) loadExtras(selectedLead.id, selectedLead.clientId, true)
        }}
        onDeleted={() => setSelectedId(null)}
      />

      <LostReasonDialog
        open={mutations.lostRequest !== null}
        leadName={mutations.lostRequest?.leadName ?? null}
        onConfirm={mutations.confirmLostMove}
        onCancel={mutations.cancelLostMove}
      />

      <p aria-live="polite" className="sr-only">
        {mutations.announcement}
      </p>
    </>
  )
}
