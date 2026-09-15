import type { Metadata } from "next"
import Link from "next/link"
import { FilterXIcon, InboxIcon, PlusIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import { PageHeading } from "@/components/crm/page-placeholder"
import { LeadFilters } from "@/components/leads/lead-filters"
import { LeadsSummary } from "@/components/leads/leads-summary"
import { LeadsWorkspace } from "@/components/leads/leads-workspace"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"
import { requireMembership } from "@/lib/auth/session"
import { getOrganizationMembers } from "@/lib/clientes/members"
import { LEADS_LIST_LIMIT, LEADS_PATH } from "@/lib/leads/constants"
import { createLeadsClient } from "@/lib/leads/db"
import {
  hasActiveLeadFilters,
  LEAD_PERIOD_LABELS,
  parseLeadListFilters,
  type RawSearchParams,
} from "@/lib/leads/filters"
import {
  canCreateLeads,
  canSeeLeadTrackingIds,
  canViewAllLeads,
} from "@/lib/leads/permissions"
import {
  getLeadSummary,
  listLandingPages,
  listLeadCampaigns,
  listLeads,
} from "@/lib/leads/queries"

export const metadata: Metadata = {
  title: "Leads",
}

type LeadsPageProps = {
  searchParams: Promise<RawSearchParams>
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const [{ user, membership }, params] = await Promise.all([requireMembership(), searchParams])
  const organizationId = membership.organizationId
  const role = membership.role
  const filters = parseLeadListFilters(params)
  const now = new Date()
  const supabase = await createLeadsClient()

  const [landingPages, members, campaigns, summary] = await Promise.all([
    listLandingPages(supabase, organizationId),
    getOrganizationMembers(organizationId),
    listLeadCampaigns(supabase, organizationId),
    getLeadSummary(supabase, organizationId, now),
  ])

  const result = await listLeads(supabase, {
    organizationId,
    userId: user.id,
    filters,
    now,
    landingPages,
    options: { showTrackingIds: canSeeLeadTrackingIds(role) },
  })

  const canCreate = canCreateLeads(role)
  const wonCount = result.leads.filter((lead) => lead.stage === "won").length
  const isFiltered = hasActiveLeadFilters(filters)

  const description =
    role === "broker"
      ? "Leads atribuídos a você e os sem responsável, que você pode assumir."
      : role === "capturer" || role === "finance"
        ? "Leads atribuídos a você (somente leitura)."
        : "Contatos das landing pages, portais e site, do primeiro contato até virar cliente."

  const newLeadButton = canCreate ? (
    <NewLeadDialog members={members} currentUserId={user.id} role={role} trigger={<Button />}>
      <PlusIcon data-icon="inline-start" />
      Novo lead
    </NewLeadDialog>
  ) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeading title="Leads" description={description} />
        {newLeadButton}
      </div>

      <LeadsSummary
        counts={summary}
        wonCount={wonCount}
        totalCount={result.leads.length}
        periodLabel={LEAD_PERIOD_LABELS[filters.periodo]}
      />

      <LeadFilters
        filters={filters}
        members={members}
        landingPages={landingPages}
        campaigns={campaigns}
        showMemberOptions={canViewAllLeads(role)}
      />

      {result.failed ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Não foi possível carregar os leads</AlertTitle>
          <AlertDescription>
            Pode ser uma instabilidade momentânea. Recarregue a página em instantes.
          </AlertDescription>
        </Alert>
      ) : result.leads.length === 0 ? (
        isFiltered ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FilterXIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum lead encontrado</EmptyTitle>
              <EmptyDescription>Nenhum lead corresponde aos filtros escolhidos.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" render={<Link href={LEADS_PATH} />} nativeButton={false}>
                Limpar filtros
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum lead por aqui</EmptyTitle>
              <EmptyDescription>
                Os contatos das landing pages aparecem aqui assim que alguém preenche o formulário.
                {canCreate ? " Você também pode cadastrar um lead que chegou por outro canal." : ""}
              </EmptyDescription>
            </EmptyHeader>
            {newLeadButton ? <EmptyContent>{newLeadButton}</EmptyContent> : null}
          </Empty>
        )
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {result.truncated ? (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>Mostrando os {LEADS_LIST_LIMIT.toLocaleString("pt-BR")} leads mais recentes</AlertTitle>
              <AlertDescription>
                Use o filtro de período ou de responsável para ver os mais antigos.
              </AlertDescription>
            </Alert>
          ) : null}
          <LeadsWorkspace
            leads={result.leads}
            members={members}
            currentUserId={user.id}
            role={role}
            nowMs={now.getTime()}
            view={filters.visao}
          />
        </div>
      )}
    </div>
  )
}
