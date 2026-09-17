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
import { PushSettings, type PushDevice } from "@/components/push/push-settings"
import { PageShell } from "@/components/shared/page-shell"
import { SettingsNav } from "@/components/shared/settings-nav"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { requireMembership, requireUser } from "@/lib/auth/session"
import { todayInSaoPaulo } from "@/lib/configuracoes/dates"
import { maskPhoneBr } from "@/lib/configuracoes/masks"
import { getVapidConfig } from "@/lib/push/config"
import { createClient } from "@/lib/supabase/server"

import { EmailPreferencesCard } from "./email-preferences-card"

export const metadata: Metadata = {
  title: "Meu perfil",
}

/** Aparelhos com avisos no celular ligados (sem endpoint nem chaves; RLS: só os do usuário). */
async function loadPushDevices(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, device_label, created_at, last_delivered_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error(`[push] lista de aparelhos falhou (código ${error.code ?? "vazio"})`)
    return []
  }

  return data.map((row): PushDevice => ({
    id: row.id,
    label: row.device_label,
    createdAt: row.created_at,
    lastDeliveredAt: row.last_delivered_at,
  }))
}

export default async function PerfilPage() {
  // A sub-navegação de configurações filtra os itens pelo papel na imobiliária atual.
  const [user, { membership }] = await Promise.all([requireUser(), requireMembership()])
  const supabase = await createClient()
  // Sem as chaves VAPID a opção de avisos no celular não aparece.
  const vapid = getVapidConfig()
  const [{ data: profile, error }, pushDevices] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, avatar_url, creci_number, creci_state, creci_valid_until")
      .eq("id", user.id)
      .maybeSingle(),
    vapid ? loadPushDevices(supabase) : Promise.resolve(null),
  ])

  if (error) {
    throw new Error(`Não foi possível carregar o perfil (${error.code ?? "erro"}).`)
  }

  return (
    <PageShell
      variant="settings"
      nav={<SettingsNav role={membership.role} />}
      header={
        <PageHeading
          title="Meu perfil"
          description="Seus dados, CRECI, avisos no celular, e-mails automáticos e senha."
        />
      }
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
                <dd className="wrap-break-word">{membership.organization.name}</dd>
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
      {vapid && pushDevices ? (
        <Card>
          <CardHeader>
            <CardTitle>Avisos no celular</CardTitle>
            <CardDescription>
              Receba o lead novo e o prazo de primeiro contato na hora, mesmo com o CRM fechado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PushSettings publicKey={vapid.publicKey} devices={pushDevices} />
          </CardContent>
        </Card>
      ) : null}
      <EmailPreferencesCard />
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
