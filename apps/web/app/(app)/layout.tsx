import type { Metadata } from "next"
import { cookies } from "next/headers"
import { unstable_rethrow } from "next/navigation"
import { Suspense } from "react"

import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { Toaster } from "@workspace/ui/components/toast"

import { SubscriptionBanner } from "@/components/billing/subscription-banner"
import { APP_NAME } from "@/components/crm/brand"
import { CrmHeader } from "@/components/crm/crm-header"
import { CrmLoadError } from "@/components/crm/crm-load-error"
import { CrmSidebar } from "@/components/crm/crm-sidebar"
import { SupabaseSetupNotice } from "@/components/crm/supabase-setup-notice"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { requireMembership, type MembershipContext } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import {
  buildTenantOrigin,
  getAppOrigin,
  getTenancyMode,
  isValidTenantSlug,
} from "@/lib/tenant/urls"

export const metadata: Metadata = {
  title: {
    template: `%s · ${APP_NAME}`,
    default: APP_NAME,
  },
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />
  }

  // A imobiliária vem do subdomínio (modo subdomain: header do proxy conferido
  // com o Host) ou do cookie validado (modo single-host), e precisa de
  // membership ativa. Ver requireMembership para os redirecionamentos. Páginas
  // e Server Actions repetem a checagem (layouts não re-renderizam em
  // navegação no cliente).
  // O error.tsx deste grupo não cobre erros deste layout, por isso o try/catch;
  // unstable_rethrow devolve ao Next os redirects e sinais internos.
  let context: MembershipContext

  try {
    context = await requireMembership()
  } catch (error) {
    unstable_rethrow(error)
    console.error(
      "[crm] falha ao carregar as imobiliárias do usuário:",
      error instanceof Error ? error.message : "erro desconhecido"
    )
    return <CrmLoadError />
  }

  const { user, membership, memberships } = context
  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"
  const tenancyMode = getTenancyMode()
  const isSubdomain = tenancyMode === "subdomain"

  return (
    <Toaster>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <CrmSidebar
          role={membership.role}
          currentOrganizationId={membership.organizationId}
          tenancyMode={tenancyMode}
          // Host único: links relativos (evita trocar de host em deploys de preview).
          appOrigin={isSubdomain ? getAppOrigin() : ""}
          organizations={memberships.map((item) => ({
            id: item.organizationId,
            name: item.organization.name,
            roleLabel: ROLE_LABELS[item.role],
            origin:
              isSubdomain && isValidTenantSlug(item.organization.slug)
                ? buildTenantOrigin(item.organization.slug)
                : null,
          }))}
          user={{
            name: user.fullName ?? user.email ?? "Usuário",
            email: user.email,
            avatarUrl: user.avatarUrl,
          }}
        />
        <SidebarInset>
          <CrmHeader />
          {/* Aviso de assinatura: não bloqueia a página nem quebra se a RPC falhar. */}
          <Suspense fallback={null}>
            <SubscriptionBanner organizationId={membership.organizationId} role={membership.role} />
          </Suspense>
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </Toaster>
  )
}
