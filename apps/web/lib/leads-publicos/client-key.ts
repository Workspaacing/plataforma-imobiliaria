import "server-only"

import { createHmac, randomBytes } from "node:crypto"

/**
 * p_client_key de submit_landing_lead: HMAC-SHA256 do IP do visitante, para o
 * limite de envios por visitante sem guardar o IP em claro.
 *
 * Chave: CAPTURE_FORM_SECRET (ou NEXT_SERVER_ACTIONS_ENCRYPTION_KEY), derivada
 * com HMAC para este uso — o mesmo segredo assina o token antirrobô com outro
 * rótulo. Sem nenhuma das duas, usa uma chave aleatória do processo (o limite
 * por visitante só fica consistente com uma instância).
 */

const KEY_LABEL = "lp-client-key:v1"
const MAX_IP_LENGTH = 100

type GlobalWithKey = typeof globalThis & { __lpClientKey?: Buffer }

type HeaderReader = { get(name: string): string | null }

function getHashKey() {
  const secret =
    process.env.CAPTURE_FORM_SECRET?.trim() ||
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim()

  if (secret) {
    return createHmac("sha256", secret).update(KEY_LABEL).digest()
  }

  const store = globalThis as GlobalWithKey
  store.__lpClientKey ??= randomBytes(32)
  return store.__lpClientKey
}

/**
 * Primeiro valor de x-forwarded-for, ou x-real-ip. Confiável apenas atrás de
 * um proxy/plataforma que sobrescreve esses cabeçalhos (ex.: Vercel).
 */
function readClientIp(requestHeaders: HeaderReader) {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = forwarded || requestHeaders.get("x-real-ip")?.trim()

  if (!ip || ip.length > MAX_IP_LENGTH) {
    return null
  }

  return ip.toLowerCase()
}

export function hashClientKey(requestHeaders: HeaderReader) {
  const ip = readClientIp(requestHeaders) ?? "ip-desconhecido"

  return createHmac("sha256", getHashKey()).update(ip).digest("hex")
}
