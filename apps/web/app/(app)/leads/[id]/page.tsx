import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LeadDetailView } from "@/components/leads/lead-detail-view"
import { LeadViewLogger } from "@/components/leads/lead-view-logger"
import { requireMembership } from "@/lib/auth/session"
import { getOrganizationMembers } from "@/lib/clientes/members"
import { createLeadsClient } from "@/lib/leads/db"
import { canSeeLeadTrackingIds } from "@/lib/leads/permissions"
import { getLead, getLeadDetailExtras } from "@/lib/leads/queries"

export const metadata: Metadata = {
  title: "Lead",
}

type LeadPageProps = {
  params: Promise<{ id: string }>
}

export default async function LeadPage({ params }: LeadPageProps) {
  const [{ user, membership }, { id }] = await Promise.all([requireMembership(), params])
  const organizationId = membership.organizationId
  const lead = await getLead(organizationId, id, canSeeLeadTrackingIds(membership.role))

  if (!lead) {
    notFound()
  }

  const now = new Date()
  const supabase = await createLeadsClient()
  const [members, extras] = await Promise.all([
    getOrganizationMembers(organizationId),
    getLeadDetailExtras(supabase, organizationId, lead.clientId),
  ])

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <LeadViewLogger leadId={lead.id} />
        <LeadDetailView
          lead={lead}
          members={members}
          extras={extras}
          currentUserId={user.id}
          role={membership.role}
          nowMs={now.getTime()}
        />
      </div>
    </div>
  )
}
