"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  LeadAdPlatformBadges,
  LeadDuplicateBadge,
  LeadRoutingBadges,
  LeadSourceBadge,
  LeadStageBadge,
} from "@/components/leads/lead-badges"
import { LeadStageSelect } from "@/components/leads/lead-stage-select"
import { formatDateTime } from "@/lib/format"
import type { Role } from "@/lib/auth/roles"
import { getMemberName, type MemberOption } from "@/lib/clientes/options"
import { getLeadInterestLabel } from "@/lib/leads/constants"
import type { LeadStage } from "@/lib/leads/db-types"
import { formatRelativeShort, maskLeadPhone } from "@/lib/leads/format"
import { canEditLead } from "@/lib/leads/permissions"
import type { LeadItem, LeadSlaSettings } from "@/lib/leads/types"

type LeadsTableProps = {
  leads: LeadItem[]
  members: MemberOption[]
  nowMs: number
  sla: LeadSlaSettings
  currentUserId: string
  role: Role
  onOpenLead: (leadId: string) => void
  onMoveLead: (leadId: string, stage: LeadStage, index: number | null) => void
}

/** Visão em lista (telefone mascarado: o completo fica no detalhe). */
export function LeadsTable({
  leads,
  members,
  nowMs,
  sla,
  currentUserId,
  role,
  onOpenLead,
  onMoveLead,
}: LeadsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Imóvel</TableHead>
            <TableHead>Interesse</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Campanha</TableHead>
            <TableHead className="text-end">Entrada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const canMove = canEditLead(role, { assignedTo: lead.assignedTo }, currentUserId)
            const contact = maskLeadPhone(lead.phone) ?? (lead.email ? "E-mail" : "—")

            return (
              <TableRow key={lead.id}>
                <TableCell className="max-w-64">
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenLead(lead.id)}
                      className="max-w-full truncate rounded-sm text-start font-medium underline-offset-4 outline-hidden hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {lead.name}
                    </button>
                    <div className="flex flex-wrap gap-1 empty:hidden">
                      <LeadRoutingBadges lead={lead} nowMs={nowMs} sla={sla} />
                      <LeadDuplicateBadge hasDuplicate={lead.hasDuplicate} />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {canMove ? (
                    <LeadStageSelect
                      size="sm"
                      className="w-40"
                      value={lead.stage}
                      onValueChange={(stage) => onMoveLead(lead.id, stage, null)}
                      aria-label={`Etapa de ${lead.name}`}
                    />
                  ) : (
                    <LeadStageBadge stage={lead.stage} />
                  )}
                </TableCell>
                <TableCell className="max-w-48">
                  <div className="flex flex-wrap gap-1">
                    <LeadSourceBadge lead={lead} />
                    <LeadAdPlatformBadges platforms={lead.adPlatforms} />
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {lead.property ? (
                    <span title={lead.property.title}>{lead.property.code}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{getLeadInterestLabel(lead.interest) ?? "—"}</TableCell>
                <TableCell>
                  {lead.assignedTo ? (
                    getMemberName(members, lead.assignedTo)
                  ) : (
                    <span className="text-muted-foreground">Sem responsável</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">{contact}</TableCell>
                <TableCell className="max-w-40 truncate">{lead.utm.campaign ?? "—"}</TableCell>
                <TableCell className="text-end tabular-nums">
                  <time dateTime={lead.createdAt} title={formatDateTime(lead.createdAt)}>
                    {formatRelativeShort(lead.createdAt, nowMs)}
                  </time>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
