import type { Metadata } from "next"
import Link from "next/link"
import { LayoutTemplateIcon, PlusIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react"

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
import { LandingPagesTable, type LandingTableRow } from "@/components/marketing/landing-pages-table"
import { StatusTabs } from "@/components/propostas/status-tabs"
import { PageShell } from "@/components/shared/page-shell"
import { requireMembership } from "@/lib/auth/session"
import { getLandingTemplate } from "@/lib/landing/templates"
import { isLandingTemplateKey } from "@/lib/landing/types"
import {
  LANDING_PAGES_PATH,
  LANDING_STATUS_LABELS,
  LANDING_STATUSES,
  NEW_LANDING_PAGE_PATH,
} from "@/lib/marketing/constants"
import { canEditLandingPages } from "@/lib/marketing/permissions"
import { listLandingPages } from "@/lib/marketing/queries"
import { getLandingPublicUrl } from "@/lib/marketing/urls"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Landing pages",
}

type SearchParams = Record<string, string | string[] | undefined>

const STATUS_TAB_LABELS = {
  published: "Publicadas",
  draft: "Rascunhos",
  archived: "Arquivadas",
} as const

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function LandingPagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [{ membership }, params] = await Promise.all([requireMembership(), searchParams])
  const statusParam = firstValue(params.status)
  const status = LANDING_STATUSES.find((value) => value === statusParam) ?? null
  const canEdit = canEditLandingPages(membership.role)

  const supabase = await createClient()
  const result = await listLandingPages(supabase, membership.organizationId)

  const heading = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <PageHeading
        title="Landing pages"
        description="Páginas de campanha com a marca da imobiliária. Os contatos entram direto no funil do CRM."
      />
      {canEdit && result.available ? (
        <Button render={<Link href={NEW_LANDING_PAGE_PATH} />} nativeButton={false}>
          <PlusIcon data-icon="inline-start" />
          Criar landing page
        </Button>
      ) : null}
    </div>
  )

  if (!result.available) {
    return (
      <PageShell>
        {heading}
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Landing pages ainda não ativadas</AlertTitle>
          <AlertDescription>
            O banco desta instalação ainda não tem as tabelas das landing pages. Assim que a
            atualização for aplicada, as páginas aparecem aqui.
          </AlertDescription>
        </Alert>
      </PageShell>
    )
  }

  const items = result.items
  const counts = {
    all: items.filter((item) => item.status !== "archived").length,
    published: items.filter((item) => item.status === "published").length,
    draft: items.filter((item) => item.status === "draft").length,
    archived: items.filter((item) => item.status === "archived").length,
  }

  const visible = items.filter((item) =>
    status ? item.status === status : item.status !== "archived"
  )

  const rows: LandingTableRow[] = visible.map((item) => ({
    id: item.id,
    name: item.name,
    templateName: isLandingTemplateKey(item.template)
      ? getLandingTemplate(item.template).name
      : "Modelo desconhecido",
    status: item.status,
    publicUrl: getLandingPublicUrl(membership.organization.slug, item.slug),
    leadCount: item.leadCount,
    publishedAt: item.publishedAt,
  }))

  return (
    <PageShell>
      {heading}

      {items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutTemplateIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma landing page ainda</EmptyTitle>
            <EmptyDescription>
              {canEdit
                ? "Escolha um dos 9 modelos, aplique a marca da imobiliária e publique. Cada contato vira um lead no funil."
                : "Quando o dono, o gerente ou um assistente criar uma landing page, ela aparece aqui."}
            </EmptyDescription>
          </EmptyHeader>
          {canEdit ? (
            <EmptyContent>
              <Button render={<Link href={NEW_LANDING_PAGE_PATH} />} nativeButton={false}>
                <PlusIcon data-icon="inline-start" />
                Criar landing page
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <>
          <StatusTabs
            allLabel="Ativas"
            allCount={counts.all}
            items={LANDING_STATUSES.map((value) => ({
              value,
              label: STATUS_TAB_LABELS[value],
              count: counts[value],
            }))}
          />

          {rows.length > 0 ? (
            <LandingPagesTable rows={rows} canEdit={canEdit} />
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {status
                    ? `Nenhuma landing page com status “${LANDING_STATUS_LABELS[status]}”`
                    : "Nenhuma landing page ativa"}
                </EmptyTitle>
                <EmptyDescription>
                  {status === "archived"
                    ? "As páginas arquivadas aparecem aqui."
                    : "Todas as landing pages desta imobiliária estão arquivadas."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  render={<Link href={LANDING_PAGES_PATH} />}
                  nativeButton={false}
                >
                  Ver páginas ativas
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </>
      )}
    </PageShell>
  )
}
