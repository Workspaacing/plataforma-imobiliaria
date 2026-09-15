import { z } from "zod"

import { isValidPhoneBr, normalizePhoneBr } from "@workspace/core/br/documents"

import { isDateKey, toDateKey, zonedToIso } from "@/lib/agenda/datetime"
import {
  isLeadInterest,
  LEAD_LOST_REASON_MAX_LENGTH,
  LEAD_MESSAGE_MAX_LENGTH,
  LEAD_NAME_MAX_LENGTH,
  LEAD_STAGES,
  LEADS_LIST_LIMIT,
  MANUAL_LEAD_SOURCES,
} from "@/lib/leads/constants"
import type { LeadInsert } from "@/lib/leads/db-types"

export const leadIdSchema = z.guid("Lead inválido.")

const entityOptionSchema = z.object({
  id: z.guid("Opção inválida."),
  label: z.string(),
  description: z.string().nullable(),
})

// -----------------------------------------------------------------------------
// Novo lead manual
// -----------------------------------------------------------------------------

/**
 * Formulário de novo lead. Entrada e saída são do mesmo tipo (sem transform),
 * para o react-hook-form e a Server Action usarem o mesmo schema; a
 * normalização para o banco fica em `toLeadInsertRow`.
 */
export const newLeadFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(LEAD_NAME_MAX_LENGTH, `O nome pode ter no máximo ${LEAD_NAME_MAX_LENGTH} caracteres.`),
    email: z.string().trim().max(254, "E-mail inválido."),
    phone: z.string().trim().max(20, "Telefone inválido."),
    source: z.enum(MANUAL_LEAD_SOURCES, "Selecione a origem."),
    interest: z.string(),
    property: entityOptionSchema.nullable(),
    assignedTo: z.string(),
    message: z
      .string()
      .trim()
      .max(
        LEAD_MESSAGE_MAX_LENGTH,
        `A mensagem pode ter no máximo ${LEAD_MESSAGE_MAX_LENGTH.toLocaleString("pt-BR")} caracteres.`
      ),
    hasConsent: z.boolean(),
    consentDate: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.name.length < 2) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Informe o nome do lead." })
    }

    if (values.email && !z.email().safeParse(values.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "E-mail inválido." })
    }

    if (values.phone && !isValidPhoneBr(values.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Número inválido. Informe o DDD e o número.",
      })
    }

    if (!values.email && !values.phone) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Informe um telefone ou um e-mail para retornar o contato.",
      })
    }

    if (values.interest && !isLeadInterest(values.interest)) {
      ctx.addIssue({ code: "custom", path: ["interest"], message: "Interesse inválido." })
    }

    if (values.assignedTo && !z.guid().safeParse(values.assignedTo).success) {
      ctx.addIssue({ code: "custom", path: ["assignedTo"], message: "Responsável inválido." })
    }

    if (values.hasConsent) {
      if (!isDateKey(values.consentDate)) {
        ctx.addIssue({
          code: "custom",
          path: ["consentDate"],
          message: "Informe a data em que o contato autorizou o uso dos dados.",
        })
      } else if (values.consentDate > toDateKey(new Date())) {
        ctx.addIssue({
          code: "custom",
          path: ["consentDate"],
          message: "A data do consentimento não pode ser no futuro.",
        })
      }
    }
  })

export type NewLeadFormValues = z.infer<typeof newLeadFormSchema>

export const EMPTY_NEW_LEAD_FORM_VALUES: NewLeadFormValues = {
  name: "",
  email: "",
  phone: "",
  source: "manual",
  interest: "",
  property: null,
  assignedTo: "",
  message: "",
  hasConsent: false,
  consentDate: "",
}

/** Valores já validados para as colunas de `leads` (sem organização e responsável). */
export function toLeadInsertRow(
  values: NewLeadFormValues,
  now: Date = new Date()
): Omit<LeadInsert, "organization_id" | "assigned_to"> {
  let consentAt: string | null = null

  if (values.hasConsent && isDateKey(values.consentDate)) {
    consentAt =
      values.consentDate === toDateKey(now)
        ? now.toISOString()
        : zonedToIso(values.consentDate, "12:00")
  }

  const message = values.message.trim()

  return {
    name: values.name.trim(),
    email: values.email ? values.email.trim().toLowerCase() : null,
    phone: values.phone ? normalizePhoneBr(values.phone) : null,
    message: message || null,
    interest: values.interest || null,
    source: values.source,
    property_id: values.property?.id ?? null,
    stage: "new",
    consent_at: consentAt,
  }
}

// -----------------------------------------------------------------------------
// Movimentação no funil
// -----------------------------------------------------------------------------

export const lostReasonSchema = z
  .string()
  .trim()
  .min(3, "Informe o motivo da perda.")
  .max(
    LEAD_LOST_REASON_MAX_LENGTH,
    `O motivo pode ter no máximo ${LEAD_LOST_REASON_MAX_LENGTH} caracteres.`
  )

export const lostReasonFormSchema = z.object({ reason: lostReasonSchema })

export type LostReasonFormValues = z.infer<typeof lostReasonFormSchema>

export const moveLeadSchema = z
  .object({
    leadId: leadIdSchema,
    stage: z.enum(LEAD_STAGES, "Etapa inválida."),
    /** Nova posição do lead; null mantém a atual. */
    position: z.number().nullable(),
    lostReason: z.string().nullable(),
    /** Outras posições da coluna, quando foi preciso renumerar. */
    renumber: z
      .array(z.object({ id: leadIdSchema, position: z.number() }))
      .max(LEADS_LIST_LIMIT),
  })
  .superRefine((values, ctx) => {
    if (values.stage === "lost" && !lostReasonSchema.safeParse(values.lostReason ?? "").success) {
      ctx.addIssue({
        code: "custom",
        path: ["lostReason"],
        message: lostReasonSchema.safeParse(values.lostReason ?? "").error?.issues[0]?.message ??
          "Informe o motivo da perda.",
      })
    }
  })

export type MoveLeadInput = z.infer<typeof moveLeadSchema>

// -----------------------------------------------------------------------------
// Conversão em cliente
// -----------------------------------------------------------------------------

export const convertLeadSchema = z.object({
  leadId: leadIdSchema,
  /** Cliente existente para vincular; null cria um novo. */
  clientId: z.guid("Cliente inválido.").nullable(),
  /** Base legal escolhida quando o lead não tem consentimento registrado. */
  legalBasis: z.string(),
  consentDate: z.string(),
})

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>
