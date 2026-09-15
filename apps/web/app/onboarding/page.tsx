import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon, LogOutIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { OnboardingForm } from "@/app/onboarding/onboarding-form"
import { BrandLogo } from "@/components/crm/brand"
import { getFirstName } from "@/components/crm/utils"
import { signOut } from "@/lib/auth/actions"
import { TENANT_PICKER_PATH } from "@/lib/auth/routes"
import { getMemberships, requireUser } from "@/lib/auth/session"
import { tryGetRootDomain } from "@/lib/tenant/urls"

export const metadata: Metadata = {
  title: "Criar imobiliária",
}

/** Onboarding no domínio raiz (o proxy redireciona o subdomínio para cá). */
export default async function OnboardingPage() {
  const user = await requireUser()
  const memberships = await getMemberships(user.id)
  const firstName = getFirstName(user.fullName)
  const hasOrganizations = memberships.length > 0
  const rootDomain = tryGetRootDomain()

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex items-center justify-between gap-4 p-4 md:px-10 md:py-6">
        <BrandLogo />
        <div className="flex items-center gap-2">
          {hasOrganizations ? (
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={TENANT_PICKER_PATH} />}
              nativeButton={false}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Minhas imobiliárias
            </Button>
          ) : null}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOutIcon data-icon="inline-start" />
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 pb-10 md:items-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>{hasOrganizations ? "Nova imobiliária" : "Crie sua imobiliária"}</CardTitle>
            <CardDescription>
              {firstName ? `${firstName}, ` : ""}
              {hasOrganizations
                ? "cadastre mais uma imobiliária. Você será o dono dela e ela terá o próprio endereço."
                : "falta pouco. Cadastre a imobiliária para começar a usar o CRM; você poderá convidar a equipe depois."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm
              slugAffix={
                rootDomain
                  ? { position: "end", text: `.${rootDomain}` }
                  : { position: "start", text: "captar/" }
              }
            />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
