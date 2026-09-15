// Rotas e regras de redirecionamento compartilhadas entre proxy, páginas e actions.

export const LOGIN_PATH = "/entrar"
export const SIGN_UP_PATH = "/cadastro"
export const RECOVER_PASSWORD_PATH = "/recuperar-senha"
export const RESET_PASSWORD_PATH = "/redefinir-senha"
export const ONBOARDING_PATH = "/onboarding"
export const HOME_PATH = "/painel"

/**
 * Página intermediária dos links com `token_hash` (/auth/confirm): o token só
 * é consumido depois do clique em "Continuar". Pública pelo prefixo "/auth".
 */
export const CONFIRM_LINK_PATH = "/auth/confirmar"

/** Prefixo das páginas públicas de convite (ver lib/configuracoes/invitations.ts). */
export const INVITATION_PATH_PREFIX = "/convite/"

const PUBLIC_PATHS = new Set([
  LOGIN_PATH,
  SIGN_UP_PATH,
  RECOVER_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
])

/** `/lp` são as landing pages públicas das imobiliárias (tráfego pago e redes sociais). */
const PUBLIC_PREFIXES = ["/auth", "/captar", "/api/feeds", "/convite", "/lp"]

/** Rotas que só fazem sentido para quem ainda não entrou. */
const GUEST_ONLY_PATHS = new Set([LOGIN_PATH, SIGN_UP_PATH, RECOVER_PASSWORD_PATH])

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "")
  }

  return pathname
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isPublicPath(pathname: string) {
  const path = normalizePathname(pathname)

  return (
    PUBLIC_PATHS.has(path) ||
    PUBLIC_PREFIXES.some((prefix) => matchesPrefix(path, prefix))
  )
}

export function isGuestOnlyPath(pathname: string) {
  return GUEST_ONLY_PATHS.has(normalizePathname(pathname))
}

/**
 * Aceita apenas caminhos relativos do próprio app (evita open redirect) e
 * nunca devolve rotas que levariam a um loop (login, cadastro, /auth/*).
 */
export function sanitizeRedirectPath(
  value: string | null | undefined,
  fallback: string = HOME_PATH
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback
  }

  if (value.includes("\\")) {
    return fallback
  }

  try {
    const base = "http://app.local"
    const url = new URL(value, base)

    if (url.origin !== base) {
      return fallback
    }

    if (isGuestOnlyPath(url.pathname) || matchesPrefix(url.pathname, "/auth")) {
      return fallback
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

/** Anexa `?next=` a um caminho, para preservá-lo entre /entrar e /cadastro. */
export function appendNextParam(path: string, next: string | null | undefined) {
  if (!next) {
    return path
  }

  return `${path}?${new URLSearchParams({ next }).toString()}`
}
