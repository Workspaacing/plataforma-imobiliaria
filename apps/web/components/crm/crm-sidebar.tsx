"use client"

import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

import { getNavGroupsForRole } from "@/components/crm/nav-config"
import { NavMain } from "@/components/crm/nav-main"
import { NavUser, type NavUserData } from "@/components/crm/nav-user"
import {
  OrganizationSwitcher,
  type OrganizationOption,
} from "@/components/crm/organization-switcher"
import type { Role } from "@/lib/auth/roles"

export function CrmSidebar({
  organizations,
  currentOrganizationId,
  role,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizations: OrganizationOption[]
  currentOrganizationId: string
  role: Role
  user: NavUserData
}) {
  const groups = React.useMemo(() => getNavGroupsForRole(role), [role])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher
          organizations={organizations}
          currentOrganizationId={currentOrganizationId}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
