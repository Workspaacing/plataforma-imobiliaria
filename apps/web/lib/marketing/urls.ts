/**
 * Endereço público de uma landing page:
 *   <NEXT_PUBLIC_SITE_URL>/lp/<slug-da-imobiliária>/<slug-da-página>
 */
export function buildLandingPublicPath(organizationSlug: string, pageSlug: string) {
  return `/lp/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(pageSlug)}`
}

export function buildLandingPublicUrl(siteUrl: string, organizationSlug: string, pageSlug: string) {
  return `${siteUrl.replace(/\/+$/, "")}${buildLandingPublicPath(organizationSlug, pageSlug)}`
}

/** Exibição sem protocolo (ex.: prévia de resultado de busca). */
export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "")
}
