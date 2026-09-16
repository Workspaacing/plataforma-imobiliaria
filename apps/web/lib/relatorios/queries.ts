import "server-only"

import type { ReportPeriod } from "@workspace/core/reports/period"
import {
  brokerRates,
  rate,
  stageRates,
  type BrokerRates,
  type StageRates,
} from "@workspace/core/reports/rates"

import type { Role } from "@/lib/auth/roles"
import { isRole } from "@/lib/auth/roles"
import { LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS, LEAD_STAGES } from "@/lib/leads/constants"
import type { LeadSource, LeadStage } from "@/lib/leads/db-types"
import { createClient } from "@/lib/supabase/server"

/**
 * Dados da tela /relatorios.
 *
 * Toda soma acontece no Postgres, nas RPCs `security invoker` da migração
 * `relatorios_desempenho`: o Node recebe uma linha por corretor, uma por etapa
 * e uma por origem — nunca a lista de leads, de imóveis ou de clientes. O RLS
 * da sessão decide o que entra na conta, e o recorte por papel (corretor vê só
 * o próprio número) é aplicado dentro da própria RPC.
 *
 * Falha não derruba a página: cada relatório volta com `failed: true` e a tela
 * mostra o aviso no lugar daquele bloco.
 */

function logFailure(scope: string, error: unknown) {
  console.error(
    `[relatorios] falha ao carregar ${scope}:`,
    error instanceof Error ? error.message : "erro desconhecido"
  )
}

/** Número que vem do Postgres como numeric pode chegar como texto ou nulo. */
function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export type ReportScope = {
  organizationId: string
  period: ReportPeriod
  /** Corretor escolhido no filtro. A RPC ignora quando quem chama é corretor. */
  broker: string | null
}

// -----------------------------------------------------------------------------
// Desempenho por corretor
// -----------------------------------------------------------------------------

export type BrokerReportRow = {
  userId: string
  name: string
  role: Role | null
  active: boolean
  leadsReceived: number
  leadsAnswered: number
  leadsInSla: number
  leadsWon: number
  leadsLost: number
  leadsOpen: number
  /** Leads que a roleta tirou do corretor por estouro do prazo (número de gestão). */
  leadsTakenBySla: number
  firstResponseMedianMinutes: number | null
  propertiesCaptured: number
  proposalsMade: number
  proposalsClosed: number
  proposalsClosedAmount: number
  rates: BrokerRates
}

export type BrokerReportTotals = {
  leadsReceived: number
  leadsAnswered: number
  leadsInSla: number
  leadsWon: number
  leadsLost: number
  leadsOpen: number
  propertiesCaptured: number
  proposalsMade: number
  proposalsClosed: number
  proposalsClosedAmount: number
  rates: BrokerRates
}

export type BrokerReport = {
  rows: BrokerReportRow[]
  totals: BrokerReportTotals
  failed: boolean
}

const EMPTY_BROKER_TOTALS: BrokerReportTotals = {
  leadsReceived: 0,
  leadsAnswered: 0,
  leadsInSla: 0,
  leadsWon: 0,
  leadsLost: 0,
  leadsOpen: 0,
  propertiesCaptured: 0,
  proposalsMade: 0,
  proposalsClosed: 0,
  proposalsClosedAmount: 0,
  rates: { answerRate: null, slaRate: null, winRate: null, proposalCloseRate: null },
}

/**
 * Soma da equipe. É a soma das linhas JÁ agregadas pelo banco (uma por
 * corretor), não uma varredura da base — a conta pesada continua no Postgres.
 */
function sumBrokerRows(rows: readonly BrokerReportRow[]): BrokerReportTotals {
  const totals = { ...EMPTY_BROKER_TOTALS }

  for (const row of rows) {
    totals.leadsReceived += row.leadsReceived
    totals.leadsAnswered += row.leadsAnswered
    totals.leadsInSla += row.leadsInSla
    totals.leadsWon += row.leadsWon
    totals.leadsLost += row.leadsLost
    totals.leadsOpen += row.leadsOpen
    totals.propertiesCaptured += row.propertiesCaptured
    totals.proposalsMade += row.proposalsMade
    totals.proposalsClosed += row.proposalsClosed
    totals.proposalsClosedAmount += row.proposalsClosedAmount
  }

  return { ...totals, rates: brokerRates(totals) }
}

export async function loadBrokerReport(scope: ReportScope): Promise<BrokerReport> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("report_broker_performance", {
      p_organization_id: scope.organizationId,
      p_from: scope.period.from,
      p_to: scope.period.to,
    })

    if (error) {
      logFailure("o desempenho por corretor", error)
      return { rows: [], totals: EMPTY_BROKER_TOTALS, failed: true }
    }

    const rows: BrokerReportRow[] = (data ?? []).map((row) => {
      const counters = {
        leadsReceived: toNumber(row.leads_received),
        leadsAnswered: toNumber(row.leads_answered),
        leadsInSla: toNumber(row.leads_in_sla),
        leadsWon: toNumber(row.leads_won),
        leadsLost: toNumber(row.leads_lost),
        proposalsMade: toNumber(row.proposals_made),
        proposalsClosed: toNumber(row.proposals_closed),
      }

      return {
        userId: row.user_id,
        name: toText(row.full_name) ?? "Membro sem nome",
        role: isRole(row.member_role) ? row.member_role : null,
        active: row.member_active !== false,
        ...counters,
        leadsOpen: toNumber(row.leads_open),
        leadsTakenBySla: toNumber(row.leads_taken_by_sla),
        firstResponseMedianMinutes: toNullableNumber(row.first_response_median_minutes),
        propertiesCaptured: toNumber(row.properties_captured),
        proposalsClosedAmount: toNumber(row.proposals_closed_amount),
        rates: brokerRates(counters),
      }
    })

    // O corretor escolhido no filtro é aplicado aqui só para a gestão: a RPC já
    // devolve uma linha só quando quem chama não pode ver a equipe.
    const filtered = scope.broker ? rows.filter((row) => row.userId === scope.broker) : rows

    return { rows: filtered, totals: sumBrokerRows(filtered), failed: false }
  } catch (error) {
    logFailure("o desempenho por corretor", error)
    return { rows: [], totals: EMPTY_BROKER_TOTALS, failed: true }
  }
}

// -----------------------------------------------------------------------------
// Funil por etapa
// -----------------------------------------------------------------------------

export type FunnelStageRow = {
  stage: LeadStage
  label: string
  entered: number
  advanced: number
  lostAfter: number
  stillThere: number
  medianHours: number | null
  avgHours: number | null
  rates: StageRates
}

export type FunnelReport = {
  stages: FunnelStageRow[]
  /** Entradas somadas, para a tela saber se o funil está vazio. */
  totalEntered: number
  failed: boolean
}

export async function loadFunnelReport(scope: ReportScope): Promise<FunnelReport> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("report_stage_funnel", {
      p_organization_id: scope.organizationId,
      p_from: scope.period.from,
      p_to: scope.period.to,
      ...(scope.broker ? { p_user_id: scope.broker } : {}),
    })

    if (error) {
      logFailure("o funil por etapa", error)
      return { stages: [], totalEntered: 0, failed: true }
    }

    const byStage = new Map((data ?? []).map((row) => [row.stage, row]))
    let totalEntered = 0

    const stages = LEAD_STAGES.map((stage): FunnelStageRow => {
      const row = byStage.get(stage)
      const counters = {
        entered: toNumber(row?.entered),
        advanced: toNumber(row?.advanced),
        lostAfter: toNumber(row?.lost_after),
        stillThere: toNumber(row?.still_there),
      }

      totalEntered += counters.entered

      return {
        stage,
        label: LEAD_STAGE_LABELS[stage],
        ...counters,
        medianHours: toNullableNumber(row?.median_hours),
        avgHours: toNullableNumber(row?.avg_hours),
        rates: stageRates(counters),
      }
    })

    return { stages, totalEntered, failed: false }
  } catch (error) {
    logFailure("o funil por etapa", error)
    return { stages: [], totalEntered: 0, failed: true }
  }
}

// -----------------------------------------------------------------------------
// Origem do lead
// -----------------------------------------------------------------------------

export type SourceReportRow = {
  /** Chave só para o React; a identidade é a combinação canal + página + utm. */
  key: string
  source: LeadSource | null
  sourceLabel: string
  landingPageName: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  leads: number
  answered: number
  won: number
  lost: number
  openLeads: number
  /** Ganhos ÷ leads: a conta que separa quem traz volume de quem traz negócio. */
  winRate: number | null
}

export type SourceReport = {
  rows: SourceReportRow[]
  totalLeads: number
  totalWon: number
  failed: boolean
}

function sourceLabelOf(source: string | null) {
  return source && source in LEAD_SOURCE_LABELS
    ? LEAD_SOURCE_LABELS[source as LeadSource]
    : "Origem não informada"
}

export async function loadSourceReport(scope: ReportScope): Promise<SourceReport> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("report_lead_sources", {
      p_organization_id: scope.organizationId,
      p_from: scope.period.from,
      p_to: scope.period.to,
      p_limit: 100,
      ...(scope.broker ? { p_user_id: scope.broker } : {}),
    })

    if (error) {
      logFailure("a origem dos leads", error)
      return { rows: [], totalLeads: 0, totalWon: 0, failed: true }
    }

    let totalLeads = 0
    let totalWon = 0

    const rows: SourceReportRow[] = (data ?? []).map((row, index) => {
      const leads = toNumber(row.leads)
      const won = toNumber(row.won)

      totalLeads += leads
      totalWon += won

      return {
        key: [
          row.source ?? "sem-origem",
          row.landing_page_id ?? "",
          row.utm_source ?? "",
          row.utm_medium ?? "",
          row.utm_campaign ?? "",
          index,
        ].join("|"),
        source: (toText(row.source) as LeadSource | null) ?? null,
        sourceLabel: sourceLabelOf(toText(row.source)),
        landingPageName: toText(row.landing_page_name),
        utmSource: toText(row.utm_source),
        utmMedium: toText(row.utm_medium),
        utmCampaign: toText(row.utm_campaign),
        leads,
        answered: toNumber(row.answered),
        won,
        lost: toNumber(row.lost),
        openLeads: toNumber(row.open_leads),
        winRate: rate(won, leads),
      }
    })

    return { rows, totalLeads, totalWon, failed: false }
  } catch (error) {
    logFailure("a origem dos leads", error)
    return { rows: [], totalLeads: 0, totalWon: 0, failed: true }
  }
}

// -----------------------------------------------------------------------------
// Motivo da perda
// -----------------------------------------------------------------------------

export const NO_LOST_REASON_LABEL = "Sem motivo informado"

export type LostReasonRow = {
  reason: string | null
  label: string
  total: number
  share: number | null
}

export type LostReasonReport = {
  rows: LostReasonRow[]
  total: number
  failed: boolean
}

export async function loadLostReasonReport(scope: ReportScope): Promise<LostReasonReport> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("report_lead_lost_reasons", {
      p_organization_id: scope.organizationId,
      p_from: scope.period.from,
      p_to: scope.period.to,
      p_limit: 20,
      ...(scope.broker ? { p_user_id: scope.broker } : {}),
    })

    if (error) {
      logFailure("os motivos de perda", error)
      return { rows: [], total: 0, failed: true }
    }

    const raw = (data ?? []).map((row) => ({
      reason: toText(row.lost_reason),
      total: toNumber(row.total),
    }))

    const total = raw.reduce((sum, row) => sum + row.total, 0)

    return {
      rows: raw.map((row) => ({
        reason: row.reason,
        label: row.reason ?? NO_LOST_REASON_LABEL,
        total: row.total,
        share: rate(row.total, total),
      })),
      total,
      failed: false,
    }
  } catch (error) {
    logFailure("os motivos de perda", error)
    return { rows: [], total: 0, failed: true }
  }
}
