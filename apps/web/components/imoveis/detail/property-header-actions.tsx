"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightLeftIcon, ChevronDownIcon, PencilIcon } from "lucide-react"

import {
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUS_VALUES,
  type PropertyStatus,
} from "@workspace/core/properties/enums"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { changePropertyStatusAction } from "@/lib/imoveis/property-actions"

function isPropertyStatus(value: unknown): value is PropertyStatus {
  return typeof value === "string" && (PROPERTY_STATUS_VALUES as readonly string[]).includes(value)
}

export function PropertyHeaderActions({
  propertyId,
  status,
  canEdit,
  requirementIssues,
  completeHref,
}: {
  propertyId: string
  status: PropertyStatus
  canEdit: boolean
  requirementIssues: string[]
  completeHref: string
}) {
  const [isPending, startTransition] = React.useTransition()
  const [optimisticStatus, setOptimisticStatus] = React.useOptimistic(status)
  const hasIssues = requirementIssues.length > 0

  if (!canEdit) return null

  function handleStatusChange(next: unknown) {
    if (!isPropertyStatus(next) || next === optimisticStatus) return

    startTransition(async () => {
      setOptimisticStatus(next)
      const result = await changePropertyStatusAction(propertyId, next)

      if (result.ok) {
        toast.add({ title: result.message ?? "Status alterado.", type: "success" })
      } else {
        toast.add({ title: "Não foi possível alterar o status", description: result.error, type: "error" })
      }
    })
  }

  return (
    <div className="flex flex-wrap gap-2 lg:justify-end">
      <Button variant="outline" render={<Link href={`/imoveis/${propertyId}/editar`} />} nativeButton={false}>
        <PencilIcon data-icon="inline-start" />
        Editar
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" disabled={isPending} />}>
          {isPending ? <Spinner data-icon="inline-start" /> : <ArrowRightLeftIcon data-icon="inline-start" />}
          {PROPERTY_STATUS_LABELS[optimisticStatus]}
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Alterar status</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={optimisticStatus} onValueChange={handleStatusChange}>
              {PROPERTY_STATUS_VALUES.map((value) => (
                <DropdownMenuRadioItem key={value} value={value} disabled={value !== "draft" && hasIssues}>
                  {PROPERTY_STATUS_LABELS[value]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          {hasIssues ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal whitespace-normal">
                  Para sair do rascunho: {requirementIssues.join(" ")}
                </DropdownMenuLabel>
                <DropdownMenuItem render={<Link href={completeHref} />}>
                  <PencilIcon />
                  Completar cadastro
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
