import Link from "next/link"
import { ArrowLeftIcon, MapPinIcon } from "lucide-react"

import type { Tables } from "@workspace/database/types"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { ImobScoreBadge } from "@/components/imoveis/imob-score-badge"
import { PortalPublishCard } from "@/components/imoveis/detail/portal-publish-card"
import { PropertyHeaderActions } from "@/components/imoveis/detail/property-header-actions"
import { PropertyCover } from "@/components/imoveis/property-cover"
import { PropertyStatusBadge } from "@/components/imoveis/property-status-badge"
import { formatCurrency } from "@/lib/format"
import { getDisplayPrices } from "@/lib/imoveis/mappers"

export function PropertyHeader({
  property,
  coverPath,
  score,
  canEdit,
  requirementIssues,
  completeHref,
  portalErrors,
  portalWarnings,
}: {
  property: Tables<"properties">
  coverPath: string | null
  score: number
  canEdit: boolean
  requirementIssues: string[]
  completeHref: string
  portalErrors: string[]
  portalWarnings: string[]
}) {
  const location = [property.neighborhood, [property.city, property.state].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(", ")
  const prices = getDisplayPrices(property)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/imoveis" />} nativeButton={false}>
          <ArrowLeftIcon data-icon="inline-start" />
          Imóveis
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
          <PropertyCover
            storagePath={coverPath}
            alt={`Foto de capa do imóvel ${property.code}`}
            className="aspect-4/3 w-full shrink-0 sm:w-48"
          />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {property.code}
              </Badge>
              <PropertyStatusBadge status={property.status} />
              <ImobScoreBadge score={score} showLabel showName />
              {property.published_to_portals ? <Badge variant="secondary">Nos portais</Badge> : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">{property.title}</h1>
            {location ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{location}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {prices.map((price) => (
                <div key={price.label} className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{price.label}</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {formatCurrency(price.value)}
                    {price.value != null && price.suffix ? (
                      <span className="text-sm font-normal text-muted-foreground">{price.suffix}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <PropertyHeaderActions
            propertyId={property.id}
            status={property.status}
            canEdit={canEdit}
            requirementIssues={requirementIssues}
            completeHref={completeHref}
          />
          <PortalPublishCard
            propertyId={property.id}
            status={property.status}
            published={property.published_to_portals}
            publishedAt={property.published_at}
            canEdit={canEdit}
            errors={portalErrors}
            warnings={portalWarnings}
          />
        </div>
      </div>
    </div>
  )
}
