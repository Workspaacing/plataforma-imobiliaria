import Link from "next/link"

import { AuthCover } from "@/app/(auth)/_components/auth-cover"
import { BrandLogo } from "@/components/crm/brand"
import { SupabaseSetupNotice } from "@/components/crm/supabase-setup-notice"
import { isSupabaseConfigured } from "@/lib/supabase/env"

/** Moldura das telas de autenticação (grupo (auth) e /auth/confirmar). */
export function AuthShell({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/">
            <BrandLogo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <AuthCover />
    </div>
  )
}
