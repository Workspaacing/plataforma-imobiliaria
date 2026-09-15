import { NextResponse, type NextRequest } from "next/server"

import type { createClient } from "@/lib/supabase/server"
import { HOME_PATH, INVITATION_PATH_PREFIX, LOGIN_PATH, ONBOARDING_PATH } from "@/lib/auth/routes"
import { getSiteUrl } from "@/lib/auth/site-url"

/**
 * Origem pública usada nos redirecionamentos de /auth. Mesma fonte dos links de
 * e-mail (NEXT_PUBLIC_SITE_URL): nunca Host/X-Forwarded-Host da requisição.
 */
export function getRequestOrigin() {
  return getSiteUrl()
}

type LoginRedirectParams = {
  /** Código de erro exibido em /entrar (ver getAuthQueryErrorMessage). */
  erro?: string
  /** Código de aviso positivo exibido em /entrar (ver getAuthQueryNotice). */
  aviso?: string
  /** Destino já sanitizado para depois do login. */
  next?: string
}

/** Caminho relativo de /entrar com `erro`, `aviso` e `next` (para redirect()). */
export function buildLoginPath(params: LoginRedirectParams) {
  const search = new URLSearchParams()

  if (params.erro) search.set("erro", params.erro)
  if (params.aviso) search.set("aviso", params.aviso)
  if (params.next && params.next !== HOME_PATH) search.set("next", params.next)

  const query = search.toString()

  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH
}

export function redirectToLogin(params: LoginRedirectParams) {
  return NextResponse.redirect(new URL(buildLoginPath(params), getRequestOrigin()))
}

export function getLinkErrorCode(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("error_code") ?? searchParams.get("error")

  if (!code) {
    return null
  }

  return code === "otp_expired" ? "link-expirado" : "link-invalido"
}

type AuthErrorLike = { name?: string; code?: string }

/**
 * O code verifier do PKCE fica num cookie do navegador que pediu o link. Se o
 * link for aberto em outro navegador (ou no app de e-mail), ele não existe.
 */
export function isPkceVerifierMissing(error: AuthErrorLike) {
  return (
    error.code === "pkce_code_verifier_not_found" ||
    error.name === "AuthPKCECodeVerifierMissingError"
  )
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Se o usuário da sessão atual já é membro de alguma imobiliária (RLS filtra por ele). */
async function userHasMembership(supabase: SupabaseServerClient) {
  const { data, error } = await supabase.from("memberships").select("id").limit(1)
  return !error && (data?.length ?? 0) > 0
}

/**
 * Destino final da confirmação de cadastro (/auth/callback e /auth/confirm).
 * Só respeita um `next` de convite quando o usuário recém-confirmado ainda não
 * tem imobiliária; nos demais casos mantém o comportamento atual (onboarding).
 */
export async function resolveSignUpNext(supabase: SupabaseServerClient, next: string) {
  if (!next.startsWith(INVITATION_PATH_PREFIX)) {
    return ONBOARDING_PATH
  }

  return (await userHasMembership(supabase)) ? ONBOARDING_PATH : next
}
