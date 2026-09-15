"use client"

import * as React from "react"
import Link from "next/link"
import { BookmarkCheckIcon, EyeIcon, MoreHorizontalIcon, PencilIcon } from "lucide-react"

import { LISTING_PURPOSE_LABELS } from "@workspace/core/properties/enums"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import type { ComboboxOption } from "@/components/propostas/option-combobox"
import {
  ProposalFormDialog,
  type EditableProposal,
  type ProposalPropertyOption,
} from "@/components/propostas/proposal-form-dialog"
import { formatDateOnly } from "@/lib/chaves/datetime"
import { formatCurrency } from "@/lib/format"
import { changeProposalStatus, reserveProperty } from "@/lib/propostas/actions"
import { amountToBrlInput } from "@/lib/propostas/money"
import type { ProposalRow } from "@/lib/propostas/queries"
import {
  getAllowedTransitions,
  getTransitionCopy,
  isOpenProposal,
  PROPOSAL_STATUS_BADGE,
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
} from "@/lib/propostas/status"

export type ProposalTableRow = ProposalRow & {
  canUpdate: boolean
  isExpired: boolean
}

type ReserveOffer = { propertyId: string; propertyLabel: string }

function propertyLabel(row: ProposalTableRow) {
  return row.property ? `${row.property.code} · ${row.property.title}` : "Imóvel"
}

function toEditable(row: ProposalTableRow): EditableProposal {
  const open = isOpenProposal(row.status)

  return {
    id: row.id,
    readOnly: !open || !row.canUpdate,
    readOnlyReason: !open
      ? `Proposta ${PROPOSAL_STATUS_LABELS[row.status].toLowerCase()}: não pode mais ser editada.`
      : !row.canUpdate
        ? "Só o corretor da proposta ou quem edita o imóvel pode alterar esta proposta."
        : null,
    propertyLabel: propertyLabel(row),
    clientLabel: row.client?.name ?? "Cliente sem acesso",
    brokerLabel: row.brokerLabel,
    values: {
      propertyId: row.propertyId,
      clientId: row.clientId,
      brokerId: row.brokerId ?? "",
      purpose: row.purpose,
      amount: amountToBrlInput(row.amount),
      paymentTerms: row.paymentTerms ?? "",
      conditions: row.conditions ?? "",
      validUntil: row.validUntil ?? "",
    },
  }
}

type ProposalsTableProps = {
  rows: ProposalTableRow[]
  properties: ProposalPropertyOption[]
  clients: ComboboxOption[]
  brokers: ComboboxOption[]
}

export function ProposalsTable({ rows, properties, clients, brokers }: ProposalsTableProps) {
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EditableProposal | null>(null)
  const [transition, setTransition] = React.useState<{
    row: ProposalTableRow
    to: ProposalStatus
  } | null>(null)
  const [transitionOpen, setTransitionOpen] = React.useState(false)
  const [reserveOffer, setReserveOffer] = React.useState<ReserveOffer | null>(null)
  const [reserveOpen, setReserveOpen] = React.useState(false)
  const [isChanging, startChange] = React.useTransition()
  const [isReserving, startReserve] = React.useTransition()

  function openForm(row: ProposalTableRow) {
    setEditing(toEditable(row))
    setFormOpen(true)
  }

  function openTransition(row: ProposalTableRow, to: ProposalStatus) {
    setTransition({ row, to })
    setTransitionOpen(true)
  }

  const copy = transition ? getTransitionCopy(transition.row.status, transition.to) : null

  function runTransition() {
    if (!transition) return

    const { row, to } = transition

    startChange(async () => {
      const result = await changeProposalStatus(row.id, to)

      if (!result.ok) {
        toast.add({ title: "Não foi possível alterar", description: result.error, type: "error" })
        return
      }

      toast.add({ title: result.message, type: "success" })
      setTransitionOpen(false)

      if (result.reserveOffer) {
        setReserveOffer(result.reserveOffer)
        setReserveOpen(true)
      }
    })
  }

  function runReserve() {
    if (!reserveOffer) return

    const { propertyId } = reserveOffer

    startReserve(async () => {
      const result = await reserveProperty(propertyId)

      if (!result.ok) {
        toast.add({ title: "Não foi possível reservar", description: result.error, type: "error" })
        return
      }

      toast.add({ title: result.message ?? "Imóvel reservado.", type: "success" })
      setReserveOpen(false)
    })
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Imóvel</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Corretor</TableHead>
            <TableHead>Finalidade</TableHead>
            <TableHead className="text-end">Valor</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const transitions = getAllowedTransitions(row.status)
            const canEditFields = isOpenProposal(row.status) && row.canUpdate

            return (
              <TableRow key={row.id} className={cn(row.isExpired && "bg-destructive/5")}>
                <TableCell>
                  {row.property ? (
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={`/propostas?imovel=${row.property.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {row.property.code}
                      </Link>
                      <span className="max-w-56 truncate text-muted-foreground">
                        {row.property.title}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-48 truncate">
                  {row.client?.name ?? (
                    <span className="text-muted-foreground">Cliente sem acesso</span>
                  )}
                </TableCell>
                <TableCell className="max-w-40 truncate">
                  {row.brokerLabel ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>{LISTING_PURPOSE_LABELS[row.purpose]}</TableCell>
                <TableCell className="text-end font-medium tabular-nums">
                  {formatCurrency(row.amount)}
                </TableCell>
                <TableCell>
                  {row.validUntil ? (
                    <span className={cn(row.isExpired && "font-medium text-destructive")}>
                      {row.isExpired ? "Venceu em " : ""}
                      {formatDateOnly(row.validUntil)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Sem validade</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={PROPOSAL_STATUS_BADGE[row.status]}>
                      {PROPOSAL_STATUS_LABELS[row.status]}
                    </Badge>
                    {row.isExpired ? <Badge variant="destructive">Vencida</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                      <MoreHorizontalIcon />
                      <span className="sr-only">Ações da proposta</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => openForm(row)}>
                          {canEditFields ? <PencilIcon /> : <EyeIcon />}
                          {canEditFields ? "Editar proposta" : "Ver detalhes"}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      {transitions.length > 0 ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            {transitions.map((to) => {
                              const transitionCopy = getTransitionCopy(row.status, to)

                              return (
                                <DropdownMenuItem
                                  key={to}
                                  variant={transitionCopy.destructive ? "destructive" : "default"}
                                  disabled={!row.canUpdate}
                                  onClick={() => openTransition(row, to)}
                                >
                                  {transitionCopy.action}
                                </DropdownMenuItem>
                              )
                            })}
                          </DropdownMenuGroup>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <ProposalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        properties={properties}
        clients={clients}
        brokers={brokers}
        editing={editing}
      />

      <AlertDialog open={transitionOpen} onOpenChange={setTransitionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {transition
                ? `${propertyLabel(transition.row)} · ${formatCurrency(transition.row.amount)}. `
                : ""}
              {copy?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isChanging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={copy?.destructive ? "destructive" : "default"}
              disabled={isChanging}
              onClick={runTransition}
            >
              {isChanging ? <Spinner data-icon="inline-start" /> : null}
              {copy?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <BookmarkCheckIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Marcar o imóvel como reservado?</AlertDialogTitle>
            <AlertDialogDescription>
              {reserveOffer?.propertyLabel}. Com a proposta aceita, o imóvel pode sair da lista de
              disponíveis enquanto a negociação é concluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReserving}>Agora não</AlertDialogCancel>
            <AlertDialogAction disabled={isReserving} onClick={runReserve}>
              {isReserving ? <Spinner data-icon="inline-start" /> : null}
              Marcar como reservado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
