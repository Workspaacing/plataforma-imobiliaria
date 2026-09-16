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
import { PageShell } from "@/components/shared/page-shell"
import { SettingsNav } from "@/components/shared/settings-nav"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { requireMembership, requireUser } from "@/lib/auth/session"
import { todayInSaoPaulo } from "@/lib/configuracoes/dates"
import { maskPhoneBr } from "@/lib/configuracoes/masks"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Meu perfil",
}

export default async function PerfilPage() {
  // A sub-navegação de configurações filtra os itens pelo papel na imobiliária atual.
  const [user, { membership }] = await Promise.all([requireUser(), requireMembership()])
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
    <PageShell
      variant="settings"
      nav={<SettingsNav role={membership.role} />}
      header={<PageHeading title="Meu perfil" description="Seus dados, telefone, CRECI e senha." />}
      rail={
        <>
          <Card>
            <CardHeader>
              <CardTitle>Acesso</CardTitle>
              <CardDescription>Conta usada para entrar no CRM.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">E-mail</dt>
                <dd className="break-all">{user.email ?? "Não informado"}</dd>
                <dt className="text-muted-foreground">Imobiliária</dt>
                <dd className="break-words">{membership.organization.name}</dd>
                <dt className="text-muted-foreground">Papel</dt>
                <dd>{ROLE_LABELS[membership.role]}</dd>
              </dl>
            </CardContent>
          </Card>
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Dados e CRECI</CardTitle>
          <CardDescription>Valem para todas as imobiliárias em que você trabalha.</CardDescription>
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
    </PageShell>
  )
}
