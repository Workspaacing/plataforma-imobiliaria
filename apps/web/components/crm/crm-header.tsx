"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"

import { EXTRA_PAGE_TITLES, findNavMatch } from "@/components/crm/nav-config"
import { ThemeToggle } from "@/components/crm/theme-toggle"

const SEGMENT_LABELS: Record<string, string> = {
  novo: "Novo",
  nova: "Nova",
  editar: "Editar",
}

function labelForSegment(segment: string) {
  const label = SEGMENT_LABELS[segment]

  if (label) {
    return label
  }

  if (/^[0-9a-f-]{8,}$/i.test(segment)) {
    return "Detalhes"
  }

  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function HeaderBreadcrumb() {
  const pathname = usePathname()
  const match = findNavMatch(pathname)

  if (!match) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{EXTRA_PAGE_TITLES[pathname] ?? "CRM"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  const { group, item } = match
  const trail = pathname
    .slice(item.url.length)
    .split("/")
    .filter(Boolean)
  const showGroup = group.title !== item.title && group.title !== "Principal"

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {showGroup ? (
          <>
            <BreadcrumbItem className="hidden md:block">{group.title}</BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
          </>
        ) : null}
        {trail.length === 0 ? (
          <BreadcrumbItem>
            <BreadcrumbPage>{item.title}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={item.url} />}>{item.title}</BreadcrumbLink>
            </BreadcrumbItem>
            {trail.map((segment, index) => {
              const isLast = index === trail.length - 1
              const href = `${item.url}/${trail.slice(0, index + 1).join("/")}`

              return (
                <React.Fragment key={href}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{labelForSegment(segment)}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={href} />}>
                        {labelForSegment(segment)}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function CrmHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ms-1" />
        <Separator
          orientation="vertical"
          className="me-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <HeaderBreadcrumb />
      </div>
      <div className="flex items-center gap-2 px-4">
        <ThemeToggle />
      </div>
    </header>
  )
}
