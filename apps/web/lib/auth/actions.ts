"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import type { ActionResult } from "@/lib/auth/action-result"
import {
  ORGANIZATION_COOKIE_NAME,
  ORGANIZATION_COOKIE_OPTIONS,
} from "@/lib/auth/organization-cookie"
import { LOGIN_PATH } from "@/lib/auth/routes"
import { getCurrentUser, getMemberships } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut({ scope: "local" })
  }

  const cookieStore = await cookies()
  cookieStore.delete(ORGANIZATION_COOKIE_NAME)

  redirect(LOGIN_PATH)
}

/**
 * Troca a imobiliária atual. O id só é gravado no cookie depois de conferido
 * contra as memberships ativas do usuário.
 */
export async function switchOrganization(
  organizationId: string
): Promise<ActionResult> {
  const parsed = z.guid().safeParse(organizationId)

  if (!parsed.success) {
    return { ok: false, error: "Imobiliária inválida." }
  }

  const user = await getCurrentUser()

  if (!user) {
    redirect(LOGIN_PATH)
  }

  const memberships = await getMemberships(user.id)
  const isMember = memberships.some(
    (membership) => membership.organizationId === parsed.data
  )

  if (!isMember) {
    return { ok: false, error: "Você não faz parte desta imobiliária." }
  }

  const cookieStore = await cookies()
  cookieStore.set(ORGANIZATION_COOKIE_NAME, parsed.data, ORGANIZATION_COOKIE_OPTIONS)

  revalidatePath("/", "layout")

  return { ok: true }
}
