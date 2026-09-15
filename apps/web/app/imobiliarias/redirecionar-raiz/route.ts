import { NextResponse, type NextRequest } from "next/server"

import { getAppOrigin } from "@/lib/tenant/urls"

/**
 * Redirecionamento do proxy para o domínio raiz (www.raiz e rotas só da raiz
 * abertas num subdomínio). O proxy reescreve para cá em vez de responder o
 * redirect direto: o servidor Node do Next converte em relativo todo Location
 * de proxy cuja origem coincide com a dele (em desenvolvimento a raiz é
 * http://localhost:3000), e o navegador continuaria no subdomínio, em loop.
 *
 * A origem vem sempre do env (getAppOrigin); da URL só é aceito um caminho
 * relativo, e o destino é conferido contra essa origem (sem open redirect).
 */
function redirectToRoot(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const origin = getAppOrigin()
  const status = searchParams.get("status") === "308" ? 308 : 307
  const requested = searchParams.get("destino") ?? "/"

  const isRelativePath =
    requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")
  const target = new URL(isRelativePath ? requested : "/", origin)

  if (target.origin !== origin) {
    return NextResponse.redirect(new URL("/", origin), status)
  }

  return NextResponse.redirect(target, status)
}

export function GET(request: NextRequest) {
  return redirectToRoot(request)
}

export function HEAD(request: NextRequest) {
  return redirectToRoot(request)
}

export function POST(request: NextRequest) {
  return redirectToRoot(request)
}
