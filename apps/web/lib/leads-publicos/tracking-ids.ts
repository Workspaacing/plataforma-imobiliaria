// IDs de rastreamento configurados na landing page. Só IDs que passam por estas
// regex são interpolados nos scripts do Meta Pixel, do Google e do GTM (nada de
// texto livre em script).

const META_PIXEL_ID_PATTERN = /^\d{1,20}$/
const GOOGLE_TAG_ID_PATTERN = /^(G|GT|AW)-[A-Z0-9]{1,30}$/
const GTM_CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]{1,30}$/

function matchId(value: unknown, pattern: RegExp) {
  if (typeof value !== "string") return null

  const id = value.trim()
  return pattern.test(id) ? id : null
}

export function safeMetaPixelId(value: unknown): string | null {
  return matchId(value, META_PIXEL_ID_PATTERN)
}

export function safeGoogleTagId(value: unknown): string | null {
  return matchId(value, GOOGLE_TAG_ID_PATTERN)
}

export function safeGtmContainerId(value: unknown): string | null {
  return matchId(value, GTM_CONTAINER_ID_PATTERN)
}
