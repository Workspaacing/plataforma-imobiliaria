import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@workspace/database/types"

import {
  isGuestOnlyPath,
  isPublicPath,
  LOGIN_PATH,
  sanitizeRedirectPath,
} from "@/lib/auth/routes"
import { getSupabaseEnv } from "@/lib/supabase/env"

function redirectWithSession(
  url: URL,
  sessionResponse: NextResponse,
  sessionHeaders: Record<string, string>
) {
  const response = NextResponse.redirect(url)

  for (const cookie of sessionResponse.cookies.getAll()) {
    response.cookies.set(cookie)
  }

  for (const [key, value] of Object.entries(sessionHeaders)) {
    response.headers.set(key, value)
  }

  return response
}

/**
 * Renova a sessão do Supabase a cada requisição e aplica o redirecionamento
 * otimista de autenticação. A autorização de verdade (membership, papel)
 * acontece nos layouts, páginas e Server Actions, e no RLS do banco.
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv()

  // Sem variáveis: deixa passar. As páginas mostram a tela "Configure o Supabase".
  if (!env) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })
  let sessionHeaders: Record<string, string> = {}

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }

        response = NextResponse.next({ request })

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }

        sessionHeaders = { ...sessionHeaders, ...headers }

        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value)
        }
      },
    },
  })

  // Importante: nada entre createServerClient e getClaims. getClaims valida o
  // JWT e dispara a renovação do token quando ele está perto de expirar.
  let isAuthenticated = false

  try {
    const { data } = await supabase.auth.getClaims()
    isAuthenticated = Boolean(data?.claims?.sub)
  } catch {
    isAuthenticated = false
  }

  const { pathname, search } = request.nextUrl

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = new URL(LOGIN_PATH, request.url)

    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`)
    }

    return redirectWithSession(loginUrl, response, sessionHeaders)
  }

  if (isAuthenticated && isGuestOnlyPath(pathname)) {
    const destination = sanitizeRedirectPath(
      request.nextUrl.searchParams.get("next")
    )

    return redirectWithSession(
      new URL(destination, request.url),
      response,
      sessionHeaders
    )
  }

  return response
}
