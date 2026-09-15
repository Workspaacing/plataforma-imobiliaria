import { NextResponse, type NextRequest } from "next/server"

import {
  getLinkErrorCode,
  getRequestOrigin,
  isPkceVerifierMissing,
  redirectToLogin,
  resolveSignUpNext,
} from "@/lib/auth/request"
import { ONBOARDING_PATH, sanitizeRedirectPath } from "@/lib/auth/routes"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

/**
 * Retorno dos links de e-mail no fluxo PKCE (confirmação de cadastro, link
 * mágico e recuperação de senha): troca o `code` por uma sessão.
 *
 * Esse fluxo depende do cookie com o code verifier gravado no navegador que
 * fez o pedido. Para links que funcionam em qualquer navegador, use os modelos
 * de e-mail apontando para /auth/confirm (token_hash).
 */
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin()

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/", origin))
  }

  const { searchParams } = request.nextUrl
  const next = sanitizeRedirectPath(searchParams.get("next"))
  const isSignUp = searchParams.get("tipo") === "cadastro" || next === ONBOARDING_PATH

  const linkError = getLinkErrorCode(request)

  if (linkError) {
    return redirectToLogin({ erro: linkError, next })
  }

  const code = searchParams.get("code")

  if (!code) {
    return redirectToLogin({ erro: "link-invalido", next })
  }

  // O auth-js anexa `sb_flow_id` ao redirectTo: com ele, a troca usa o verifier
  // exato daquele pedido (e não o do pedido mais recente deste navegador).
  const flowId = searchParams.get("sb_flow_id")
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined
  )

  if (error) {
    // Só o código do erro: nada de e-mail, token ou code no log.
    console.warn(
      `[auth/callback] exchangeCodeForSession falhou: ${error.code ?? error.name}`
    )

    if (isPkceVerifierMissing(error)) {
      // O Supabase já confirmou o e-mail no /verify antes de redirecionar para
      // cá; só não dá para abrir a sessão neste navegador.
      return redirectToLogin(
        isSignUp
          ? { aviso: "email-confirmado", next }
          : { erro: "link-outro-navegador", next }
      )
    }

    return redirectToLogin({
      erro:
        error.code === "flow_state_expired" || error.code === "otp_expired"
          ? "link-expirado"
          : "link-invalido",
      next,
    })
  }

  // Cadastro sem imobiliária ainda: só o destino de convite escapa do
  // onboarding forçado (ver resolveSignUpNext).
  const finalNext = isSignUp ? await resolveSignUpNext(supabase, next) : next

  return NextResponse.redirect(new URL(finalNext, origin))
}
