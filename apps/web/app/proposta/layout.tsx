import { SupabaseSetupNotice } from "@/components/crm/supabase-setup-notice"
import { isSupabaseConfigured } from "@/lib/supabase/env"

/** Link público da proposta: sem a casca do CRM e sem exigir login. */
export default function PropostaPublicaLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />
  }

  return children
}
