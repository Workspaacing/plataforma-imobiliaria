import type { Metadata } from "next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { PageHeading } from "@/components/crm/page-placeholder"
import { PasswordForm } from "@/components/perfil/password-form"
import { ProfileForm } from "@/components/perfil/profile-form"
import { requireUser } from "@/lib/auth/session"
import { todayInSaoPaulo } from "@/lib/configuracoes/dates"
import { maskPhoneBr } from "@/lib/configuracoes/masks"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Meu perfil",
}

export default async function PerfilPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url, creci_number, creci_state, creci_valid_until")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Não foi possível carregar o perfil (${error.code ?? "erro"}).`)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <PageHeading title="Meu perfil" description="Seus dados, telefone, CRECI e senha." />
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados e CRECI</CardTitle>
            <CardDescription>
              Valem para todas as imobiliárias em que você trabalha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              email={user.email}
              today={todayInSaoPaulo()}
              defaultValues={{
                fullName: profile?.full_name ?? user.fullName ?? "",
                phone: maskPhoneBr(profile?.phone ?? ""),
                avatarUrl: profile?.avatar_url ?? "",
                creciNumber: profile?.creci_number ?? "",
                creciState: profile?.creci_state ?? "",
                creciValidUntil: profile?.creci_valid_until ?? "",
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Senha</CardTitle>
            <CardDescription>Confirme a senha atual para definir uma nova.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
