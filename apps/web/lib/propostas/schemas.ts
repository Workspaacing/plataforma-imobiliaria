import { z } from "zod"

import { parseBrlInput } from "@/lib/propostas/money"

const MAX_AMOUNT = 999_999_999_999.99

function isGuid(value: string) {
  return z.guid().safeParse(value).success
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

export const PROPOSAL_PURPOSES = ["sale", "rent"] as const

export const proposalFormSchema = z.object({
  propertyId: z.string().refine(isGuid, "Selecione o imóvel."),
  clientId: z.string().refine(isGuid, "Selecione o cliente."),
  brokerId: z.string().refine((value) => value === "" || isGuid(value), "Corretor inválido."),
  purpose: z.enum(PROPOSAL_PURPOSES, "Selecione a finalidade."),
  amount: z
    .string()
    .refine((value) => (parseBrlInput(value) ?? 0) > 0, "Informe o valor da proposta.")
    .refine((value) => (parseBrlInput(value) ?? 0) <= MAX_AMOUNT, "Valor alto demais."),
  paymentTerms: z
    .string()
    .trim()
    .max(5000, "A forma de pagamento pode ter no máximo 5.000 caracteres."),
  conditions: z.string().trim().max(5000, "As condições podem ter no máximo 5.000 caracteres."),
  validUntil: z.string().refine((value) => value === "" || isIsoDate(value), "Data inválida."),
})

export type ProposalFormValues = z.infer<typeof proposalFormSchema>

export const proposalIdSchema = z.guid("Proposta inválida.")
