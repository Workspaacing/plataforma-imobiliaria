import type { Metadata } from "next"
import Link from "next/link"
import { HandshakeIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react"
import { z } from "zod"

import {
  LISTING_PURPOSE_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPOSAL_STATUS_VALUES,
} from "@workspace/core/properties/enums"
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
import { NewProposalButton } from "@/components/propostas/new-proposal-button"
import type { ProposalPropertyOption } from "@/components/propostas/proposal-form-dialog"
import { ProposalsFilters } from "@/components/propostas/proposals-filters"
import { ProposalsTable, type ProposalTableRow } from "@/components/propostas/proposals-table"
import { StatusTabs } from "@/components/propostas/status-tabs"
import { requireMembership } from "@/lib/auth/session"
import { todayInSaoPaulo } from "@/lib/chaves/datetime"
import { getClientOptions, getPropertyOptions, getTeamMembers } from "@/lib/propostas/options"
import { canUpdateProposal, COMMERCIAL_ROLES, isSelfBrokerRole } from "@/lib/propostas/permissions"
import { listProposals, type ProposalPurpose } from "@/lib/propostas/queries"
import { isProposalExpired, PROPOSAL_STATUS_LABELS } from "@/lib/propostas/status"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Propostas",
}

type SearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function guidParam(value: string | string[] | undefined) {
  const first = firstValue(value)
  return first && z.guid().safeParse(first).success ? first : null
}

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [{ user, membership }, params] = await Promise.all([requireMembership(), searchParams])

  const statusParam = firstValue(params.status)
  const status = PROPOSAL_STATUS_VALUES.find((value) => value === statusParam) ?? null
  const propertyId = guidParam(params.imovel)
  const brokerId = guidParam(params.corretor)
  const purposeParam = firstValue(params.finalidade)
  const purpose: ProposalPurpose | null =
    purposeParam === "sale" || purposeParam === "rent" ? purposeParam : null
  const hasFilters = Boolean(status || propertyId || brokerId || purpose)

  const organizationId = membership.organizationId
  const role = membership.role
  const isCommercial = COMMERCIAL_ROLES.includes(role)
  const supabase = await createClient()

  const [{ rows, counts }, properties, members, clients] = await Promise.all([
    listProposals(supabase, organizationId, {
      status,
      propertyId,
      brokerId,
      purpose,
    }),
    getPropertyOptions(supabase, organizationId),
    getTeamMembers(supabase, organizationId),
    isCommercial ? getClientOptions(supabase, organizationId) : Promise.resolve([]),
  ])

  const today = todayInSaoPaulo()
  const tableRows: ProposalTableRow[] = rows.map((row) => ({
    ...row,
    canUpdate: row.property
      ? canUpdateProposal(role, user.id, { brokerId: row.brokerId }, row.property)
      : false,
    isExpired: isProposalExpired(row, today),
  }))

  const brokers = members
    .filter((member) => COMMERCIAL_ROLES.includes(member.role))
    .map(({ value, label }) => ({ value, label }))
  const propertyFilterOptions = properties.map(({ value, label }) => ({
    value,
    label,
  }))
  const propertyFormOptions: ProposalPropertyOption[] = properties.map((property) => ({
    value: property.value,
    label: property.label,
    description: `${PROPERTY_STATUS_LABELS[property.status]} · ${LISTING_PURPOSE_LABELS[property.purpose]}`,
    purpose: property.purpose,
  }))
  const selectedProperty = properties.find((property) => property.value === propertyId)
  const lockBroker = isSelfBrokerRole(role)
  const defaultBrokerId =
    lockBroker || brokers.some((broker) => broker.value === user.id) ? user.id : ""
  const expiredCount = tableRows.filter((row) => row.isExpired).length

  const statusItems = PROPOSAL_STATUS_VALUES.map((value) => ({
    value,
    label: PROPOSAL_STATUS_LABELS[value],
    count: counts[value],
  }))

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeading
          title="Propostas"
          description={
            selectedProperty
              ? `Propostas do imóvel ${selectedProperty.label}.`
              : "Propostas com valor, condições e status da negociação."
          }
        />
        {isCommercial && properties.length > 0 ? (
          <NewProposalButton
            properties={propertyFormOptions}
            clients={clients}
            brokers={brokers}
            defaultPropertyId={propertyId ?? undefined}
            defaultBrokerId={defaultBrokerId}
            lockBroker={lockBroker}
          />
        ) : null}
      </div>

      <StatusTabs items={statusItems} allLabel="Todas" allCount={counts.all} />

      <ProposalsFilters properties={propertyFilterOptions} brokers={brokers} />

      {expiredCount > 0 ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>
            {expiredCount === 1
              ? "1 proposta vencida sem decisão"
              : `${expiredCount} propostas vencidas sem decisão`}
          </AlertTitle>
          <AlertDescription>
            A validade passou e a proposta continua em negociação. Renove a validade, registre a
            decisão ou retire a proposta.
          </AlertDescription>
        </Alert>
      ) : null}

      {tableRows.length > 0 ? (
        <ProposalsTable
          rows={tableRows}
          properties={propertyFormOptions}
          clients={clients}
          brokers={brokers}
        />
      ) : hasFilters ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma proposta encontrada</EmptyTitle>
            <EmptyDescription>
              Nenhuma proposta corresponde aos filtros escolhidos.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" render={<Link href="/propostas" />} nativeButton={false}>
              Limpar filtros
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HandshakeIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma proposta registrada</EmptyTitle>
            <EmptyDescription>
              {properties.length === 0
                ? "Cadastre imóveis e clientes para registrar as propostas recebidas."
                : isCommercial && clients.length === 0
                  ? "Cadastre o cliente interessado para registrar a primeira proposta."
                  : "Registre as propostas dos clientes para acompanhar valores, condições e decisões."}
            </EmptyDescription>
          </EmptyHeader>
          {properties.length === 0 || (isCommercial && clients.length === 0) ? (
            <EmptyContent>
              <Button
                variant="outline"
                render={<Link href={properties.length === 0 ? "/imoveis" : "/clientes"} />}
                nativeButton={false}
              >
                {properties.length === 0 ? "Ir para imóveis" : "Ir para clientes"}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      )}
    </div>
  )
}
