"use server"

import { redirect } from "next/navigation"

import type { ActionResult } from "@/lib/auth/action-result"
import { isAccountEnumerationError, translateAuthError } from "@/lib/auth/errors"
import {
  getRecoverySessionState,
  RECOVERY_LINK_REQUIRED_MESSAGE,
} from "@/lib/auth/recovery-session"
import {
  HOME_PATH,
  INVITATION_PATH_PREFIX,
  ONBOARDING_PATH,
  RESET_PASSWORD_PATH,
  sanitizeRedirectPath,
} from "@/lib/auth/routes"
import {
  magicLinkSchema,
  recoverPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type MagicLinkValues,
  type RecoverPasswordValues,
  type ResetPasswordValues,
  type SignInValues,
  type SignUpValues,
} from "@/lib/auth/schemas"
import { buildAuthCallbackUrl, getSiteUrl } from "@/lib/auth/site-url"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

const INVALID_FORM: ActionResult = {
  ok: false,
  error: "Confira os campos destacados e tente novamente.",
}

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  error: "O Supabase ainda não foi configurado neste ambiente.",
}

export async function signInWithPassword(
  values: SignInValues,
  next?: string | null
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(values)

  if (!parsed.success) {
    return INVALID_FORM
  }

  if (!isSupabaseConfigured()) {
    return NOT_CONFIGURED
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { ok: false, error: translateAuthError(error) }
  }

  redirect(sanitizeRedirectPath(next))
}

export async function sendMagicLink(
  values: MagicLinkValues,
  next?: string | null
): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(values)

  if (!parsed.success) {
    return INVALID_FORM
  }

  if (!isSupabaseConfigured()) {
    return NOT_CONFIGURED
  }

  const { email } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: buildAuthCallbackUrl(
        await getSiteUrl(),
        sanitizeRedirectPath(next)
      ),
      // Contas novas passam pelo /cadastro, que coleta o nome completo.
      shouldCreateUser: false,
    },
  })

  if (error && !isAccountEnumerationError(error)) {
    return { ok: false, error: translateAuthError(error) }
  }

  return {
    ok: true,
    message: `Se houver uma conta para ${email}, você receberá um link de acesso em instantes. Abra-o neste mesmo navegador.`,
  }
}

export async function signUp(
  values: SignUpValues,
  next?: string | null
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(values)

  if (!parsed.success) {
    return INVALID_FORM
  }

  if (!isSupabaseConfigured()) {
    return NOT_CONFIGURED
  }

  // Sem `next` (ou um valor inválido), o destino padrão continua o onboarding:
  // um cadastro novo ainda não tem imobiliária. Um `next` de convite é
  // respeitado depois da confirmação (ver resolveSignUpNext em lib/auth/request).
  const redirectNext = sanitizeRedirectPath(next, ONBOARDING_PATH)
  const isInvitationNext = redirectNext.startsWith(INVITATION_PATH_PREFIX)

  const { email, password, fullName } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Lido pelo trigger que cria a linha em `profiles`.
      data: { full_name: fullName },
      // `tipo=cadastro` permite ao callback reconhecer a confirmação de cadastro
      // mesmo quando o link é aberto em outro navegador.
      emailRedirectTo: buildAuthCallbackUrl(await getSiteUrl(), redirectNext, {
        tipo: "cadastro",
      }),
    },
  })

  if (error) {
    return { ok: false, error: translateAuthError(error) }
  }

  // Projetos sem confirmação de e-mail já devolvem a sessão.
  if (data.session) {
    redirect(redirectNext)
  }

  return {
    ok: true,
    message: isInvitationNext
      ? `Enviamos um link de confirmação para ${email}. Abra-o neste mesmo navegador para ativar sua conta e concluir o convite.`
      : `Enviamos um link de confirmação para ${email}. Abra-o neste mesmo navegador para ativar sua conta e criar sua imobiliária.`,
  }
}

export async function requestPasswordReset(
  values: RecoverPasswordValues
): Promise<ActionResult> {
  const parsed = recoverPasswordSchema.safeParse(values)

  if (!parsed.success) {
    return INVALID_FORM
  }

  if (!isSupabaseConfigured()) {
    return NOT_CONFIGURED
  }

  const { email } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildAuthCallbackUrl(await getSiteUrl(), RESET_PASSWORD_PATH),
  })

  if (error && !isAccountEnumerationError(error)) {
    return { ok: false, error: translateAuthError(error) }
  }

  return {
    ok: true,
    message: `Se houver uma conta para ${email}, enviamos um link para criar uma nova senha.`,
  }
}

export async function updatePassword(
  values: ResetPasswordValues
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(values)

  if (!parsed.success) {
    return INVALID_FORM
  }

  if (!isSupabaseConfigured()) {
    return NOT_CONFIGURED
  }

  // Sem a senha atual, só uma sessão aberta há pouco pelo link de recuperação
  // pode trocar a senha. Quem já está logado troca em /perfil, confirmando a atual.
  const recovery = await getRecoverySessionState()

  if (recovery.status !== "recovery") {
    return { ok: false, error: RECOVERY_LINK_REQUIRED_MESSAGE }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return { ok: false, error: translateAuthError(error) }
  }

  redirect(HOME_PATH)
}
