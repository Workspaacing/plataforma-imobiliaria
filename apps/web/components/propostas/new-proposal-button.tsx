"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import type { ComboboxOption } from "@/components/propostas/option-combobox"
import {
  ProposalFormDialog,
  type ProposalPropertyOption,
} from "@/components/propostas/proposal-form-dialog"

export function NewProposalButton({
  properties,
  clients,
  brokers,
  defaultPropertyId,
  defaultBrokerId,
  lockBroker,
}: {
  properties: ProposalPropertyOption[]
  clients: ComboboxOption[]
  brokers: ComboboxOption[]
  defaultPropertyId?: string
  defaultBrokerId?: string
  /** Corretor e captador: corretor da nova proposta travado no próprio usuário. */
  lockBroker?: boolean
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        Nova proposta
      </Button>
      <ProposalFormDialog
        open={open}
        onOpenChange={setOpen}
        properties={properties}
        clients={clients}
        brokers={brokers}
        defaultPropertyId={defaultPropertyId}
        defaultBrokerId={defaultBrokerId}
        lockBroker={lockBroker}
      />
    </>
  )
}
