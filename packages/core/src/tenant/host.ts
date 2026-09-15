// Leitura do Host da requisição no multi-tenant por subdomínio.
// Módulo puro: quem chama informa o domínio raiz (ex.: "seucrm.com.br" ou,
// em desenvolvimento, "localhost:3000").

import { isValidTenantSlug } from "./slug"

/**
 * Classificação de um Host em relação ao domínio raiz:
 * - `root`: o próprio domínio raiz (login, cadastro, onboarding, escolha de imobiliária);
 * - `www`: `www.{raiz}`, tratado como apelido da raiz;
 * - `tenant`: subdomínio direto com slug válido (a existência é conferida à parte);
 * - `invalid-tenant`: outro subdomínio da raiz (reservado, formato inválido ou vários níveis);
 * - `external`: host fora da raiz (IP, URL de preview do provedor, domínio estranho).
 */
export type TenantHost =
  | { kind: "root" }
  | { kind: "www" }
  | { kind: "tenant"; slug: string }
  | { kind: "invalid-tenant" }
  | { kind: "external" }

type HostParts = { hostname: string; port: string | null }

const HOST_PATTERN = /^([^\s:/?#[\]@]+?)\.?(?::(\d{1,5}))?$/
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/

function parseHost(value: string | null | undefined): HostParts | null {
  if (typeof value !== "string") return null

  const match = HOST_PATTERN.exec(value.trim().toLowerCase())
  const hostname = match?.[1]

  if (!hostname || hostname.startsWith(".") || hostname.includes("..")) return null

  return { hostname, port: match[2] ?? null }
}

/**
 * Normaliza o domínio raiz configurado: minúsculas, sem protocolo, sem barra
 * final. Devolve `null` quando o valor não é um host (com porta opcional).
 */
export function normalizeRootDomain(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null

  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")

  const parts = parseHost(cleaned)

  if (!parts || !/^[a-z0-9.-]+$/.test(parts.hostname)) return null

  return parts.port ? `${parts.hostname}:${parts.port}` : parts.hostname
}

/** localhost, *.localhost e IPs: sem HTTPS e sem cookie compartilhado entre subdomínios. */
export function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || IPV4_PATTERN.test(hostname)
}

export function getProtocolForRootDomain(rootDomain: string): "http" | "https" {
  const parts = parseHost(rootDomain)
  return parts && isLocalHostname(parts.hostname) ? "http" : "https"
}

export function classifyHost(host: string | null | undefined, rootDomain: string): TenantHost {
  const root = parseHost(rootDomain)
  const request = parseHost(host)

  if (!root || !request) return { kind: "external" }

  // Raiz com porta (dev) exige a mesma porta; raiz sem porta aceita só as padrão.
  const samePort = root.port
    ? request.port === root.port
    : request.port === null || request.port === "80" || request.port === "443"

  if (!samePort) return { kind: "external" }

  if (request.hostname === root.hostname) return { kind: "root" }

  const suffix = `.${root.hostname}`

  if (!request.hostname.endsWith(suffix)) return { kind: "external" }

  const label = request.hostname.slice(0, -suffix.length)

  if (label === "www") return { kind: "www" }

  if (label.includes(".") || !isValidTenantSlug(label)) return { kind: "invalid-tenant" }

  return { kind: "tenant", slug: label }
}

/** Slug do subdomínio da imobiliária; `null` para qualquer outro host. */
export function parseTenantSlugFromHost(
  host: string | null | undefined,
  rootDomain: string
): string | null {
  const result = classifyHost(host, rootDomain)
  return result.kind === "tenant" ? result.slug : null
}

/**
 * Atributo `Domain` dos cookies de sessão para valerem na raiz e em todos os
 * subdomínios (ex.: ".seucrm.com.br"). `null` em localhost/IP: o navegador não
 * compartilha cookie entre `*.localhost`, então o cookie fica só no host.
 */
export function getSharedCookieDomain(rootDomain: string): string | null {
  const parts = parseHost(rootDomain)

  if (!parts || isLocalHostname(parts.hostname) || !parts.hostname.includes(".")) {
    return null
  }

  return `.${parts.hostname}`
}
