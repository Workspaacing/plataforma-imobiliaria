"use client"

import * as React from "react"
import { MessageCircleIcon } from "lucide-react"

import {
  buildLeadWhatsappMessage,
  LEAD_WHATSAPP_MESSAGE_MAX_LENGTH,
  leadFirstName,
} from "@workspace/core/leads/whatsapp-message"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"

import { leadWhatsappHref } from "@/lib/leads/format"
import type { LeadItem } from "@/lib/leads/types"

type LeadWhatsappButtonProps = {
  lead: Pick<LeadItem, "id" | "name" | "phone" | "property">
  /** Nome de quem vai conversar (o usuário logado), para a apresentação. */
  senderName: string | null
  /** Quem pode editar o lead registra o contato ao abrir a conversa. */
  canRegisterContact: boolean
  /** Mesma ação do "Registrar contato" (não espera: o WhatsApp abre na hora). */
  onContact: () => void
}

/**
 * WhatsApp da ficha do lead: oferece a mensagem inicial pronta (nome do lead e
 * imóvel de interesse, editável) e, ao abrir a conversa, registra o contato —
 * o que tira o lead de "fora do prazo". O telefone só vai no link wa.me que o
 * próprio usuário abre; nada é registrado em log.
 */
export function LeadWhatsappButton({
  lead,
  senderName,
  canRegisterContact,
  onContact,
}: LeadWhatsappButtonProps) {
  const [open, setOpen] = React.useState(false)

  if (!leadWhatsappHref(lead.phone)) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <MessageCircleIcon data-icon="inline-start" />
        WhatsApp
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Montado a cada abertura: a mensagem recomeça do texto pronto. */}
        <LeadWhatsappForm
          lead={lead}
          senderName={senderName}
          canRegisterContact={canRegisterContact}
          onOpenChat={() => {
            if (canRegisterContact) {
              onContact()
            }

            // Fecha depois do clique: o link abre a conversa antes.
            window.setTimeout(() => setOpen(false), 0)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function LeadWhatsappForm({
  lead,
  senderName,
  canRegisterContact,
  onOpenChat,
}: Omit<LeadWhatsappButtonProps, "onContact"> & { onOpenChat: () => void }) {
  const messageId = React.useId()
  const [message, setMessage] = React.useState(() =>
    buildLeadWhatsappMessage({
      leadName: lead.name,
      senderName,
      property: lead.property,
    })
  )
  const href = leadWhatsappHref(lead.phone, message)
  const firstName = leadFirstName(lead.name)

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Conversar no WhatsApp</DialogTitle>
        <DialogDescription>
          {firstName ? `Mensagem pronta para ${firstName}. ` : "Mensagem pronta. "}
          {canRegisterContact
            ? "Ao abrir a conversa, o contato fica registrado no lead."
            : "Revise o texto antes de abrir a conversa."}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={messageId}>Mensagem</FieldLabel>
          <Textarea
            id={messageId}
            rows={5}
            maxLength={LEAD_WHATSAPP_MESSAGE_MAX_LENGTH}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <FieldDescription>Dá para ajustar o texto aqui ou no próprio WhatsApp.</FieldDescription>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        {href ? (
          <Button
            render={<a href={href} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
            onClick={onOpenChat}
          >
            <MessageCircleIcon data-icon="inline-start" />
            Abrir no WhatsApp
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  )
}
