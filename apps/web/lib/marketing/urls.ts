import { buildLandingPageUrl, buildTenantUrl } from "@/lib/tenant/urls"

/*
 * Endereços das landing pages (multi-tenant por subdomínio):
 *   público: {slug-da-imobiliária}.{raiz}/lp/{slug-da-página}
 * O proxy reescreve esse endereço para a rota interna /lp/[org]/[page].
 */

/**
 * Caminho da rota interna (`/lp/[org]/[page]`). Use só em `revalidatePath`,
 * que trabalha com o destino do rewrite, nunca para exibir ou linkar.
 */
export function buildLandingPublicPath(organizationSlug: string, pageSlug: string) {
  return `/lp/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(pageSlug)}`
}

/** URL pública no subdomínio da imobiliária; null se o slug não servir de subdomínio. */
export function getLandingPublicUrl(organizationSlug: string, pageSlug: string): string | null {
  try {
    return buildLandingPageUrl(organizationSlug, pageSlug)
  } catch {
    return null
  }
}

/** Prefixo exibido no campo de endereço, ex.: "teste.localhost:3000/lp/". */
export function getLandingPublicUrlPrefix(organizationSlug: string): string | null {
  try {
    return displayUrl(buildTenantUrl(organizationSlug, "/lp/"))
  } catch {
    return null
  }
}

/** Exibição sem protocolo (ex.: prévia de resultado de busca). */
export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "")
}
