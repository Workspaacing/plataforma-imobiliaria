import { redirect } from "next/navigation"

import { SupabaseSetupNotice } from "@/components/crm/supabase-setup-notice"
import { HOME_PATH, LOGIN_PATH } from "@/lib/auth/routes"
import { getCurrentUser } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />
  }

  const user = await getCurrentUser()

  redirect(user ? HOME_PATH : LOGIN_PATH)
}
