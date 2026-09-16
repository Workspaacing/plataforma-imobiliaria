// Opções dos cookies de sessão do Supabase Auth. Sem `server-only`: o proxy,
// o servidor e o navegador usam a mesma regra.

import type { CookieOptionsWithName } from "@supabase/ssr"

import { classifyHost, getSharedCookieDomain } from "@workspace/core/tenant/host"

import { tryGetRootDomain } from "@/lib/tenant/urls"

/**
 * Em produção, grava os cookies com Domain=.raiz (ex.: ".seucrm.com.br") para a
 * sessão valer na raiz e em todos os subdomínios: o usuário circula entre as
 * suas imobiliárias sem entrar de novo.
 *
 * Fica host-only (sem Domain) quando:
 * - a raiz é localhost/IP: o navegador não compartilha cookie entre `*.localhost`;
 * - o host atual não pertence à raiz (ex.: URL de preview): o navegador
 *   recusaria um cookie com Domain de outro site.
 */
export function getSessionCookieOptions(
  host: string | null | undefined
): CookieOptionsWithName | undefined {
  const root = tryGetRootDomain()
  const domain = root ? getSharedCookieDomain(root) : null

  if (!root || !domain || classifyHost(host, root).kind === "external") {
    return undefined
  }

  return { domain }
}
