import type { Metadata } from "next"
import Link from "next/link"
import { InfoIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

import { PageHeading } from "@/components/crm/page-placeholder"
import { ExportLinks } from "@/components/relatorios/export-links"
import { ReportFilters } from "@/components/relatorios/report-filters"
import {
  BrokersSection,
  FunnelSection,
  LostReasonsSection,
  SourcesSection,
} from "@/components/relatorios/report-sections"
import { ReportTabs } from "@/components/relatorios/report-tabs"
import { PageShell } from "@/components/shared/page-shell"
import { ROLE_PERMISSIONS_SETTINGS_PATH } from "@/components/shared/settings-config"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { requireMembership } from "@/lib/auth/session"
import { getOrganizationMembers } from "@/lib/clientes/members"
import { getExportRoles } from "@/lib/configuracoes/export-audit"
import { canExportData } from "@/lib/configuracoes/export-permissions"
import type { ReportDataset } from "@/lib/relatorios/datasets"
import { canSeeTeamReports, reportScopeNotice } from "@/lib/relatorios/permissions"
import {
  loadBrokerReport,
  loadFunnelReport,
  loadLostReasonReport,
  loadSourceReport,
  type ReportScope,
} from "@/lib/relatorios/queries"
import { parseReportSearchParams } from "@/lib/relatorios/url"

export const metadata: Metadata = {
  title: "Relatórios",
}

/** A base sai sempre do mesmo período e corretor que estão na tela. */
const BASE_DATASETS: readonly ReportDataset[] = ["leads", "imoveis", "clientes", "propostas"]

type SearchParams = Record<string, string | string[] | undefined>

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [{ user, membership }, params] = await Promise.all([requireMembership(), searchParams])

  const view = parseReportSearchParams(params)
  const role = membership.role
  const canSeeTeam = canSeeTeamReports(role)

  // Quem não vê a equipe não escolhe corretor: o banco ignoraria o parâmetro, e
  // a tela não deve sugerir um recorte que não existe.
  const broker = canSeeTeam ? view.broker : null
  const scope: ReportScope = {
    organizationId: membership.organizationId,
    period: view.period,
    broker,
  }

  // `getExportRoles` é memorizado por requisição: os links de exportação reusam a leitura.
  const [members, exportRoles] = await Promise.all([
    canSeeTeam ? getOrganizationMembers(membership.organizationId) : [],
    getExportRoles(membership.organizationId),
  ])
  const canExport = canExportData(role, exportRoles)
  const selfName =
    user.fullName?.trim() ||
    members.find((member) => member.id === user.id)?.name ||
    user.email ||
    ROLE_LABELS[role]

  const periodLabel = view.period.label

  // Só a aba aberta consulta o banco: as outras duas ficam para quando forem pedidas.
  const [brokerReport, lostReasons, funnel, sources] = await Promise.all([
    view.tab === "corretores" ? loadBrokerReport(scope) : null,
    view.tab === "corretores" ? loadLostReasonReport(scope) : null,
    view.tab === "funil" ? loadFunnelReport(scope) : null,
    view.tab === "origens" ? loadSourceReport(scope) : null,
  ])

  const tabDataset: ReportDataset =
    view.tab === "funil" ? "funil" : view.tab === "origens" ? "origens" : "corretores"

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeading
            title="Relatórios"
            description={`Desempenho da equipe, funil e origem dos leads em ${periodLabel}.`}
          />
          <ExportLinks
            datasets={view.tab === "corretores" ? [tabDataset, "motivos-perda"] : [tabDataset]}
            period={view.period}
            broker={broker}
            emphasizeFirst
          />
        </div>
      }
    >
      <Alert>
        <InfoIcon />
        <AlertTitle>
          {canSeeTeam ? "Visão da imobiliária" : `Visão do seu papel (${ROLE_LABELS[role]})`}
        </AlertTitle>
        <AlertDescription>{reportScopeNotice(role, selfName)}</AlertDescription>
      </Alert>

      {/* O `key` é o período: mudou o período, o filtro remonta e os campos
          nascem já sincronizados com a URL (nada de efeito copiando prop). */}
      <ReportFilters
        key={`${view.period.preset ?? "personalizado"}-${view.period.fromDay}-${view.period.toDay}`}
        period={view.period}
        broker={broker}
        tab={view.tab}
        members={members}
        canChooseBroker={canSeeTeam}
        selfName={selfName}
      />

      <ReportTabs tab={view.tab} period={view.period} broker={broker} />

      {view.tab === "corretores" && brokerReport && lostReasons ? (
        <div className="flex flex-col gap-6">
          <BrokersSection report={brokerReport} periodLabel={periodLabel} canSeeTeam={canSeeTeam} />
          <LostReasonsSection report={lostReasons} periodLabel={periodLabel} />
        </div>
      ) : null}

      {view.tab === "funil" && funnel ? (
        <FunnelSection report={funnel} periodLabel={periodLabel} />
      ) : null}

      {view.tab === "origens" && sources ? (
        <SourcesSection report={sources} periodLabel={periodLabel} />
      ) : null}

      <section className="flex flex-col gap-2 border-t pt-6">
        {canExport ? (
          <>
            <h2 className="text-sm font-medium">Exportar a base do período</h2>
            <p className="text-sm text-muted-foreground">
              Arquivo CSV com BOM UTF-8 e separador ponto e vírgula, que o Excel brasileiro abre sem
              quebrar acento. Sai com as mesmas linhas que você já enxerga no sistema
              {canSeeTeam
                ? "."
                : " — e sem CPF/CNPJ nem data de nascimento, que só o dono e o gerente exportam."}
            </p>
          </>
        ) : (
          // Sem promessa de download: o aviso abaixo diz quem exporta hoje e quem libera.
          <h2 className="text-sm font-medium">Exportação da base</h2>
        )}
        <ExportLinks datasets={BASE_DATASETS} period={view.period} broker={broker} />
        {canExport ? null : (
          <Button
            variant="link"
            size="sm"
            className="self-start px-0"
            render={<Link href={ROLE_PERMISSIONS_SETTINGS_PATH} />}
            nativeButton={false}
          >
            Ver o que cada papel pode fazer
          </Button>
        )}
      </section>
    </PageShell>
  )
}
