"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { IMPORT_DUPLICATE_MODES, IMPORT_KINDS } from "@workspace/core/import/fields"
import {
  IMPORT_BATCH_ROWS,
  IMPORT_LOOKUP_ROWS,
  IMPORT_MAX_ROWS,
  type ImportRowOutcome,
} from "@workspace/core/import/report"

import type { ActionResultWithData } from "@/lib/clientes/action-result"
import { getActionMembership } from "@/lib/configuracoes/action-context"
import { translateDatabaseError } from "@/lib/configuracoes/errors"
import {
  IMPORT_LEGAL_BASIS_VALUES,
  IMPORT_LIST_PATHS,
  IMPORT_ROLES,
  IMPORT_SETTINGS_PATH,
} from "@/lib/importacao/constants"
import { createClient } from "@/lib/supabase/server"

/**
 * Server Actions da importação. Cada uma confere o papel (dono ou gerente),
 * pega a imobiliária da sessão (nunca do navegador) e chama a RPC com o
 * cliente Supabase da sessão: RLS e as checagens do banco valem sempre.
 * Nada aqui registra o conteúdo das linhas em log.
 */

const INVALID_REQUEST =
  "Não foi possível ler os dados enviados. Recarregue a página e tente de novo."

const payloadValueSchema = z.union([
  z.string().max(10_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(200)).max(50),
])

const payloadSchema = z
  .object({ row: z.number().int().min(1).max(1_000_000) })
  .catchall(payloadValueSchema)

const kindSchema = z.enum(IMPORT_KINDS)

const findExistingSchema = z.object({
  kind: kindSchema,
  rows: z.array(payloadSchema).max(IMPORT_LOOKUP_ROWS),
})

const startSchema = z.object({
  jobId: z.guid(),
  kind: kindSchema,
  duplicateMode: z.enum(IMPORT_DUPLICATE_MODES),
  totalRows: z.number().int().min(1).max(IMPORT_MAX_ROWS),
  legalBasis: z.enum(IMPORT_LEGAL_BASIS_VALUES).nullable(),
  tag: z.string().trim().max(40).nullable(),
})

const batchSchema = z.object({
  jobId: z.guid(),
  batchIndex: z.number().int().min(0).max(4_999),
  rows: z.array(payloadSchema).min(1).max(IMPORT_BATCH_ROWS),
})

const finishSchema = z.object({
  jobId: z.guid(),
  invalidRows: z.number().int().min(0).max(IMPORT_MAX_ROWS),
  fileDuplicates: z.number().int().min(0).max(IMPORT_MAX_ROWS),
})

const outcomeSchema = z.object({
  row: z.number().int(),
  status: z.enum(["inserted", "updated", "skipped", "failed"]),
  code: z.string().optional(),
})

const batchResultSchema = z.object({
  replayed: z.boolean(),
  results: z.array(outcomeSchema),
})

const finishResultSchema = z.object({
  inserted: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
  failed: z.number().int(),
})

export type ImportBatchResult = { replayed: boolean; outcomes: ImportRowOutcome[] }

export type ImportJobTotals = z.infer<typeof finishResultSchema>

/** Linhas (números da planilha) que já existem no CRM. */
export async function findExistingImportRows(
  input: z.input<typeof findExistingSchema>
): Promise<ActionResultWithData<number[]>> {
  const parsed = findExistingSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: INVALID_REQUEST }
  }

  const auth = await getActionMembership(IMPORT_ROLES)

  if (!auth.ok) {
    return auth
  }

  if (parsed.data.rows.length === 0) {
    return { ok: true, data: [] }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("import_find_existing", {
    p_organization_id: auth.context.membership.organizationId,
    p_kind: parsed.data.kind,
    p_rows: parsed.data.rows,
  })

  if (error) {
    return {
      ok: false,
      error: translateDatabaseError(error, "Não foi possível conferir a base agora."),
    }
  }

  const lines = z.array(z.number().int()).safeParse(data)

  return lines.success ? { ok: true, data: lines.data } : { ok: false, error: INVALID_REQUEST }
}

/** Abre a importação. Repetir com o mesmo `jobId` não cria outra. */
export async function startImportJob(
  input: z.input<typeof startSchema>
): Promise<ActionResultWithData<{ jobId: string }>> {
  const parsed = startSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: INVALID_REQUEST }
  }

  const auth = await getActionMembership(IMPORT_ROLES)

  if (!auth.ok) {
    return auth
  }

  const { jobId, kind, duplicateMode, totalRows, legalBasis, tag } = parsed.data

  if (kind === "clients" && !legalBasis) {
    return { ok: false, error: "Escolha a base legal (LGPD) dos contatos importados." }
  }

  const options: Record<string, string> = {}

  if (kind === "clients" && legalBasis) {
    options.legal_basis = legalBasis

    if (tag) {
      options.tag = tag
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("import_start", {
    p_organization_id: auth.context.membership.organizationId,
    p_job_id: jobId,
    p_kind: kind,
    p_duplicate_mode: duplicateMode,
    p_total_rows: totalRows,
    p_options: options,
  })

  if (error) {
    return {
      ok: false,
      error: translateDatabaseError(error, "Não foi possível começar a importação."),
    }
  }

  return { ok: true, data: { jobId } }
}

/** Grava um lote. Reenviar o mesmo lote devolve o resultado já gravado. */
export async function importRowsBatch(
  input: z.input<typeof batchSchema>
): Promise<ActionResultWithData<ImportBatchResult>> {
  const parsed = batchSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: INVALID_REQUEST }
  }

  const auth = await getActionMembership(IMPORT_ROLES)

  if (!auth.ok) {
    return auth
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("import_batch", {
    p_organization_id: auth.context.membership.organizationId,
    p_job_id: parsed.data.jobId,
    p_batch_index: parsed.data.batchIndex,
    p_rows: parsed.data.rows,
  })

  if (error) {
    return { ok: false, error: translateDatabaseError(error, "Não foi possível gravar este lote.") }
  }

  const result = batchResultSchema.safeParse(data)

  if (!result.success) {
    return { ok: false, error: INVALID_REQUEST }
  }

  return {
    ok: true,
    data: { replayed: result.data.replayed, outcomes: result.data.results },
  }
}

/** Fecha a importação, registra na auditoria e atualiza as listas. */
export async function finishImportJob(
  input: z.input<typeof finishSchema>
): Promise<ActionResultWithData<ImportJobTotals>> {
  const parsed = finishSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: INVALID_REQUEST }
  }

  const auth = await getActionMembership(IMPORT_ROLES)

  if (!auth.ok) {
    return auth
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("import_finish", {
    p_organization_id: auth.context.membership.organizationId,
    p_job_id: parsed.data.jobId,
    p_invalid_rows: parsed.data.invalidRows,
    p_file_duplicates: parsed.data.fileDuplicates,
  })

  if (error) {
    return {
      ok: false,
      error: translateDatabaseError(error, "Não foi possível concluir a importação."),
    }
  }

  const totals = finishResultSchema.safeParse(data)

  if (!totals.success) {
    return { ok: false, error: INVALID_REQUEST }
  }

  for (const path of Object.values(IMPORT_LIST_PATHS)) {
    revalidatePath(path)
  }

  revalidatePath("/painel")
  revalidatePath(IMPORT_SETTINGS_PATH)

  return { ok: true, data: totals.data }
}
