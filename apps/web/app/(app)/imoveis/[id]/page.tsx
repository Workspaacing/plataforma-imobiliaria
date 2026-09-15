import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ClipboardListIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { TabsContent } from "@workspace/ui/components/tabs"

import { AuthorizationsPanel } from "@/components/imoveis/detail/authorizations-panel"
import {
  PropertyDetailTabs,
  type PropertyDetailTabItem,
} from "@/components/imoveis/detail/detail-tabs"
import { KeysProposalsTab } from "@/components/imoveis/detail/keys-proposals-tab"
import { MatchesTab } from "@/components/imoveis/detail/matches-tab"
import { MediaTab } from "@/components/imoveis/detail/media-tab"
import { OverviewTab } from "@/components/imoveis/detail/overview-tab"
import { OwnersPanel } from "@/components/imoveis/detail/owners-panel"
import { PropertyHeader } from "@/components/imoveis/detail/property-header"
import { PROPERTY_DETAIL_TABS, type PropertyDetailTab } from "@/components/imoveis/detail/tabs"
import { requireMembership } from "@/lib/auth/session"
import {
  getCondominiumSummary,
  getConvertedCapture,
  getPropertyAuthorizations,
  getPropertyForPage,
  getPropertyKeys,
  getPropertyMatches,
  getPropertyOwners,
  getPropertyProposals,
} from "@/lib/imoveis/detail-queries"
import { findStepForField } from "@/lib/imoveis/form-steps"
import { isUuid } from "@/lib/imoveis/ids"
import {
  computePropertyScore,
  summarizeMedia,
  todayInSaoPaulo,
  validatePropertyForPortals,
} from "@/lib/imoveis/mappers"
import {
  canDeletePropertyRecords,
  canEditProperty,
  canReadCaptureRequests,
} from "@/lib/imoveis/permissions"
import {
  getOrganizationMembers,
  getPropertyMediaRows,
  toMemberNameMap,
} from "@/lib/imoveis/queries"
import { getStatusRequirementIssues } from "@/lib/imoveis/schema"
import { createClient } from "@/lib/supabase/server"

type PropertyDetailPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PropertyDetailPageProps): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return { title: "Imóvel" }

  const { membership } = await requireMembership()
  const property = await getPropertyForPage(membership.organizationId, id).catch(() => null)

  return { title: property ? property.code : "Imóvel não encontrado" }
}

function memberName(names: Map<string, string>, id: string | null) {
  if (!id) return "—"
  return names.get(id) ?? "Membro removido"
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const [{ id }, { user, membership }] = await Promise.all([params, requireMembership()])

  if (!isUuid(id)) notFound()

  const organizationId = membership.organizationId
  const property = await getPropertyForPage(organizationId, id)

  if (!property) notFound()

  const supabase = await createClient()
  const role = membership.role

  const [media, owners, authorizations, members, condominium, matches, keys, proposals, capture] =
    await Promise.all([
      getPropertyMediaRows(supabase, organizationId, property.id),
      getPropertyOwners(supabase, organizationId, property.id),
      getPropertyAuthorizations(supabase, organizationId, property.id),
      getOrganizationMembers(supabase, organizationId),
      getCondominiumSummary(supabase, organizationId, property.condominium_id),
      getPropertyMatches(supabase, organizationId, property),
      getPropertyKeys(supabase, organizationId, property.id),
      getPropertyProposals(supabase, organizationId, property.id),
      canReadCaptureRequests(role)
        ? getConvertedCapture(supabase, organizationId, property.id)
        : Promise.resolve(null),
    ])

  const canEdit = canEditProperty(role, user.id, property)
  const canDelete = canDeletePropertyRecords(role)
  const today = todayInSaoPaulo()

  const mediaSummary = summarizeMedia(media)
  const coverPath =
    (mediaSummary.images.find((image) => image.is_cover) ?? mediaSummary.images[0])?.storage_path ??
    null
  const score = computePropertyScore(
    property,
    mediaSummary,
    authorizations.map((item) => ({
      starts_on: item.startsOn,
      ends_on: item.endsOn,
    }))
  )
  const portalValidation = validatePropertyForPortals(property, mediaSummary)

  const requirementIssues = property.status === "draft" ? getStatusRequirementIssues(property) : []
  const firstIssue = requirementIssues[0]
  const completeHref = `/imoveis/${property.id}/editar?etapa=${firstIssue ? findStepForField(firstIssue.field) : "dados"}`
  const issueMessages = requirementIssues.map((issue) => issue.message)

  const memberNames = toMemberNameMap(members)
  const ownerOptions = owners.map((owner) => ({
    value: owner.clientId,
    label: owner.clientName ?? "Cliente sem acesso",
  }))

  const counts: Partial<Record<PropertyDetailTab, number>> = {
    midia: mediaSummary.photosCount,
    proprietarios: owners.length,
    autorizacao: authorizations.length,
    compativeis: matches.length,
    "chaves-propostas": keys.length + proposals.length,
  }
  const tabs: PropertyDetailTabItem[] = PROPERTY_DETAIL_TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    count: counts[tab.value],
  }))

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <PropertyHeader
        property={property}
        coverPath={coverPath}
        score={score.score}
        canEdit={canEdit}
        requirementIssues={issueMessages}
        completeHref={completeHref}
        portalErrors={portalValidation.errors.map((issue) => issue.message)}
        portalWarnings={portalValidation.warnings.map((issue) => issue.message)}
      />

      {canEdit && issueMessages.length > 0 ? (
        <Alert>
          <ClipboardListIcon />
          <AlertTitle>Complete o cadastro para ativar o imóvel</AlertTitle>
          <AlertDescription>
            <p>Para sair do rascunho: {issueMessages.join(" ")}</p>
            <Link href={completeHref}>Completar cadastro</Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <PropertyDetailTabs tabs={tabs}>
        <TabsContent value="visao-geral">
          <OverviewTab
            property={property}
            condominium={condominium}
            capturedByName={memberName(memberNames, property.captured_by)}
            brokerName={memberName(memberNames, property.broker_id)}
            score={score}
          />
        </TabsContent>
        <TabsContent value="midia">
          <MediaTab
            propertyId={property.id}
            propertyCode={property.code}
            media={mediaSummary}
            canEdit={canEdit}
          />
        </TabsContent>
        <TabsContent value="proprietarios">
          <OwnersPanel
            propertyId={property.id}
            owners={owners}
            capture={capture}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </TabsContent>
        <TabsContent value="autorizacao">
          <AuthorizationsPanel
            propertyId={property.id}
            authorizations={authorizations}
            ownerOptions={ownerOptions}
            today={today}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </TabsContent>
        <TabsContent value="compativeis">
          <MatchesTab isActive={property.status === "active"} matches={matches} />
        </TabsContent>
        <TabsContent value="chaves-propostas">
          <KeysProposalsTab propertyId={property.id} keys={keys} proposals={proposals} />
        </TabsContent>
      </PropertyDetailTabs>
    </div>
  )
}
