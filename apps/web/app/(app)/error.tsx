"use client"

import Link from "next/link"
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import { HOME_PATH } from "@/lib/auth/routes"

/**
 * Erros das páginas do CRM (a casca continua visível). Em produção o Next só
 * repassa uma mensagem genérica e o `digest`, que casa com o log do servidor.
 */
export default function CrmError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4 lg:p-6">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Algo deu errado ao carregar esta página</EmptyTitle>
          <EmptyDescription>
            Pode ser uma instabilidade momentânea. Tente de novo; se o problema
            continuar, informe o código abaixo ao suporte.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => retry()}>
              <RotateCwIcon data-icon="inline-start" />
              Tentar de novo
            </Button>
            <Button variant="outline" render={<Link href={HOME_PATH} />} nativeButton={false}>
              Voltar ao painel
            </Button>
          </div>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">
              Código: {error.digest}
            </p>
          ) : null}
        </EmptyContent>
      </Empty>
    </div>
  )
}
