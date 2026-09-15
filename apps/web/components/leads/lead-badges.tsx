import { CopyIcon, MegaphoneIcon, TimerIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"

import { LEAD_RESPONSE_TARGET_MINUTES, LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS } from "@/lib/leads/constants"
import type { LeadStage } from "@/lib/leads/db-types"
import {
  formatElapsedShort,
  isLeadAwaitingContact,
  isLeadWithoutContact,
  LEAD_AD_PLATFORM_LABELS,
  type LeadAdPlatform,
} from "@/lib/leads/format"
import type { LeadItem } from "@/lib/leads/types"

const STAGE_BADGE_VARIANT: Record<LeadStage, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  contacted: "outline",
  qualified: "outline",
  visit_scheduled: "outline",
  proposal: "outline",
  won: "secondary",
  lost: "destructive",
}

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return <Badge variant={STAGE_BADGE_VARIANT[stage]}>{LEAD_STAGE_LABELS[stage]}</Badge>
}

/** Origem; para landing page mostra o nome da página. */
export function LeadSourceBadge({ lead }: { lead: Pick<LeadItem, "source" | "landingPage"> }) {
  const isLandingPage = lead.source === "landing_page" && lead.landingPage
  const label = isLandingPage && lead.landingPage ? lead.landingPage.name : LEAD_SOURCE_LABELS[lead.source]

  return (
    <Badge variant="outline" className="max-w-full" title={isLandingPage ? `Landing page: ${label}` : label}>
      <span className="truncate">{label}</span>
    </Badge>
  )
}

export function LeadAdPlatformBadges({ platforms }: { platforms: readonly LeadAdPlatform[] }) {
  return platforms.map((platform) => (
    <Badge key={platform} variant="secondary">
      <MegaphoneIcon data-icon="inline-start" />
      {LEAD_AD_PLATFORM_LABELS[platform]}
    </Badge>
  ))
}

/** Cronômetro do primeiro contato: vermelho quando passa da meta. */
export function LeadContactTimerBadge({
  lead,
  nowMs,
}: {
  lead: Pick<LeadItem, "stage" | "lastContactAt" | "createdAt">
  nowMs: number
}) {
  if (!isLeadWithoutContact(lead)) {
    return null
  }

  const overdue = isLeadAwaitingContact(lead, nowMs)

  return (
    <Badge
      variant={overdue ? "destructive" : "secondary"}
      title={
        overdue
          ? `Fora do prazo: a meta é o primeiro contato em até ${LEAD_RESPONSE_TARGET_MINUTES} min.`
          : `Meta: primeiro contato em até ${LEAD_RESPONSE_TARGET_MINUTES} min.`
      }
    >
      <TimerIcon data-icon="inline-start" />
      Sem contato há {formatElapsedShort(lead.createdAt, nowMs)}
    </Badge>
  )
}

export function LeadDuplicateBadge({ count }: { count: number }) {
  if (count === 0) {
    return null
  }

  return (
    <Badge
      variant="outline"
      title={`${count} registro(s) com o mesmo telefone ou e-mail nos últimos 90 dias.`}
    >
      <CopyIcon data-icon="inline-start" />
      Possível duplicado
    </Badge>
  )
}
