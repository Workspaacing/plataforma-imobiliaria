import "server-only"

import { notFound } from "next/navigation"
import { cache } from "react"

import { isPlatformAdminEmail } from "@workspace/core/caixa/platform-admins"

import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

/**
 * Equipe da plataforma: área interna fora do CRM das imobiliárias.
 *
 * Só entra quem está logado com um e-mail CONFIRMADO que esteja em
 * `PLATFORM_ADMIN_EMAILS` (lista separada por vírgula, sem diferenciar
 * maiúsculas). O resto recebe 404, sem pista de que a página existe. A regra
 * vale no servidor — na página e na rota de envio —, não em esconder link.
 */

export type PlatformAdmin = { id: string; email: string }

/**
 * Administrador da plataforma na requisição atual, ou null. A identidade vem de
 * `auth.getUser()` (consulta o Auth), e não só do JWT, para exigir o e-mail
 * confirmado: sem isso, alguém poderia criar conta com o e-mail da equipe.
 */
export const getPlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  const allowed = process.env.PLATFORM_ADMIN_EMAILS

  if (!allowed?.trim() || !isSupabaseConfigured()) {
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user

  if (error || !user?.email || !user.email_confirmed_at) {
    return null
  }

  if (!isPlatformAdminEmail(user.email, allowed)) {
    return null
  }

  return { id: user.id, email: user.email.toLowerCase() }
})

/**
 * O atalho para o Console aparece no CRM? Só decide se o link é mostrado: o
 * console confere tudo de novo em cada página.
 *
 * Barato para os clientes: e-mail fora de PLATFORM_ADMIN_EMAILS nem consulta o
 * Auth. Quem está na lista passa por `getPlatformAdmin()` (e-mail confirmado).
 */
export async function canOpenPlatformConsole(email: string | null): Promise<boolean> {
  if (!email || !isPlatformAdminEmail(email, process.env.PLATFORM_ADMIN_EMAILS)) {
    return false
  }

  return (await getPlatformAdmin()) !== null
}

/** Exige administrador da plataforma; senão 404. */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await getPlatformAdmin()

  if (!admin) {
    notFound()
  }

  return admin
}
