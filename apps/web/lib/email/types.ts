import "server-only"

import type { EmailFailureReason } from "@workspace/core/email/delivery"

export type { EmailFailureReason }

export type EmailAddress = {
  email: string
  name?: string | null
}

export type EmailMessage = {
  to: EmailAddress
  subject: string
  html: string
  text: string
  /** Sem ele, usa EMAIL_REPLY_TO (se houver). */
  replyTo?: EmailAddress | null
  /** Aparecem nos relatórios da Brevo (normalizadas: [a-z0-9_-]). */
  tags?: readonly string[]
  /** UUID; repetir o mesmo valor em até 30 min não duplica o envio. Sem ele, um novo por chamada. */
  idempotencyKey?: string
}

export type EmailSendResult =
  /** messageId é null quando a Brevo não devolve um (ex.: envio repetido já aceito). */
  { ok: true; messageId: string | null } | { ok: false; reason: EmailFailureReason }

export interface EmailProvider {
  readonly kind: "brevo" | "simulated"
  /** Nunca lança: falhas voltam como { ok: false, reason }. */
  send(message: EmailMessage): Promise<EmailSendResult>
}
