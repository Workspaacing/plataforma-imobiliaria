import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheckIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { PageHeading } from "@/components/crm/page-placeholder"
import { RolePermissions } from "@/components/configuracoes/role-permissions"
import { PageShell } from "@/components/shared/page-shell"
import { ROLE_LABELS, TEAM_MANAGER_ROLES } from "@/lib/auth/roles"
import { requireMembership } from "@/lib/auth/session"
import { TEAM_SETTINGS_PATH } from "@/components/shared/settings-config"

export const metadata: Metadata = {
  title: "Papéis e permissões",
}

/**
 * Referência aberta a todos os membros: "o que eu posso fazer aqui?" e "que
 * papel a fulana precisa ter?". A tela de Equipe continua só para dono e
 * gerente, porque lá se muda o papel das pessoas.
 */
export default async function PermissoesPage() {
  const { membership } = await requireMembership()
  const role = membership.role
  const canManageTeam = TEAM_MANAGER_ROLES.includes(role)

  return (
    <PageShell
      variant="settings"
      width="wide"
      header={
        <PageHeading
          title="Papéis e permissões"
          description={`O que cada papel pode fazer na ${membership.organization.name}.`}
        />
      }
    >
      <Alert>
        <ShieldCheckIcon />
        <AlertTitle>Você é {ROLE_LABELS[role]} nesta imobiliária</AlertTitle>
        <AlertDescription>
          {canManageTeam ? (
            <p>
              Para trocar o papel de alguém ou convidar uma pessoa nova, vá em{" "}
              <Link href={TEAM_SETTINGS_PATH}>Equipe</Link>.
            </p>
          ) : (
            <p>
              Precisa de algo que seu papel não permite? Peça ao dono ou ao gerente da imobiliária —
              são eles que mudam papéis e convidam pessoas.
            </p>
          )}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>O que cada papel faz</CardTitle>
          <CardDescription>
            Estas regras valem no banco de dados, não só na tela: um papel sem permissão não
            consegue a ação nem por atalho ou link direto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RolePermissions actorRole={role} />
        </CardContent>
      </Card>
    </PageShell>
  )
}
