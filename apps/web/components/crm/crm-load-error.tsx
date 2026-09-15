"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOutIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"

import { signOut } from "@/lib/auth/actions"

/** Exibida quando a casca do CRM não consegue carregar as imobiliárias do usuário. */
export function CrmLoadError() {
  const router = useRouter()
  const [isRetrying, startRetry] = React.useTransition()
  const [isSigningOut, startSignOut] = React.useTransition()

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Empty className="max-w-lg border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Não foi possível carregar o CRM</EmptyTitle>
          <EmptyDescription>
            Tivemos um problema ao buscar suas imobiliárias. Tente de novo em instantes; se
            persistir, fale com o suporte.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button disabled={isRetrying} onClick={() => startRetry(() => router.refresh())}>
              {isRetrying ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RotateCwIcon data-icon="inline-start" />
              )}
              Tentar de novo
            </Button>
            <Button
              variant="outline"
              disabled={isSigningOut}
              onClick={() => startSignOut(() => signOut())}
            >
              <LogOutIcon data-icon="inline-start" />
              Sair
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  )
}
