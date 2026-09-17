"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { TablesInsert } from "@workspace/database/types"

import type { ActionResult } from "@/lib/auth/action-result"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

const preferenceSchema = z.object({
  key: z.enum(["daily_digest", "visit_reminders", "weekly_report"]),
  enabled: z.boolean(),
})

const SUCCESS_MESSAGES = {
  daily_digest: ["Resumo diário ligado.", "Resumo diário desligado."],
  visit_reminders: ["Lembretes de visita ligados.", "Lembretes de visita desligados."],
  weekly_report: ["Relatório semanal ligado.", "Relatório semanal desligado."],
} as const

/** Liga ou desliga um e-mail automático da própria pessoa (upsert; RLS: só a própria linha). */
export async function setEmailPreference(values: {
  key: string
  enabled: boolean
}): Promise<ActionResult> {
  const parsed = preferenceSchema.safeParse(values)

  if (!parsed.success) {
    return { ok: false, error: "Preferência inválida." }
  }

  const { key, enabled } = parsed.data
  const user = await requireUser()
  const supabase = await createClient()
  const row: TablesInsert<"email_preferences"> =
    key === "daily_digest"
      ? { user_id: user.id, daily_digest: enabled }
      : key === "visit_reminders"
        ? { user_id: user.id, visit_reminders: enabled }
        : { user_id: user.id, weekly_report: enabled }
  // Só a coluna enviada muda; numa linha nova as outras ficam ligadas (padrão).
  const { error } = await supabase.from("email_preferences").upsert(row, { onConflict: "user_id" })

  if (error) {
    console.error(
      `[perfil/e-mails] falha ao salvar a preferência (código ${error.code || "desconhecido"})`
    )
    return { ok: false, error: "Não foi possível salvar agora. Tente de novo." }
  }

  revalidatePath("/perfil")

  const [on, off] = SUCCESS_MESSAGES[key]
  return { ok: true, message: enabled ? on : off }
}
