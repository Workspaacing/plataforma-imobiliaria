"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { findNavMatch } from "@/components/crm/nav-config"
import { getInitials } from "@/components/crm/utils"
import { switchOrganization } from "@/lib/auth/actions"

export type OrganizationOption = {
  id: string
  name: string
  roleLabel: string
}

export function OrganizationSwitcher({
  organizations,
  currentOrganizationId,
}: {
  organizations: OrganizationOption[]
  currentOrganizationId: string
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = React.useTransition()

  const current =
    organizations.find((organization) => organization.id === currentOrganizationId) ??
    organizations[0]

  if (!current) {
    return null
  }

  function handleSelect(organizationId: string) {
    if (organizationId === current?.id) {
      return
    }

    startTransition(async () => {
      const result = await switchOrganization(organizationId)

      if (!result.ok) {
        toast.add({
          title: "Não foi possível trocar de imobiliária",
          description: result.error,
          type: "error",
        })
        return
      }

      // Telas de detalhe pertencem à imobiliária anterior: volta para a seção.
      const section = findNavMatch(pathname)?.item.url

      if (section && section !== pathname) {
        router.push(section)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {getInitials(current.name)}
            </div>
            <div className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-medium">{current.name}</span>
              <span className="truncate text-xs">{current.roleLabel}</span>
            </div>
            {isPending ? (
              <Spinner className="ms-auto" />
            ) : (
              <ChevronsUpDownIcon className="ms-auto" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Imobiliárias</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={current.id}
                onValueChange={(value) => handleSelect(String(value))}
              >
                {organizations.map((organization) => (
                  <DropdownMenuRadioItem
                    key={organization.id}
                    value={organization.id}
                    disabled={isPending}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-md border text-xs">
                      {getInitials(organization.name)}
                    </div>
                    <div className="grid flex-1 text-start leading-tight">
                      <span className="truncate">{organization.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {organization.roleLabel}
                      </span>
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/onboarding" />} className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon />
                </div>
                <span className="font-medium text-muted-foreground">Nova imobiliária</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
