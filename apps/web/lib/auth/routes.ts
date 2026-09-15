// Rotas e regras de redirecionamento compartilhadas entre proxy, páginas e actions.

export const LOGIN_PATH = "/entrar"
export const SIGN_UP_PATH = "/cadastro"
export const RECOVER_PASSWORD_PATH = "/recuperar-senha"
export const RESET_PASSWORD_PATH = "/redefinir-senha"
export const ONBOARDING_PATH = "/onboarding"
export const HOME_PATH = "/painel"

/** Escolha de imobiliária no domínio raiz (links para cada subdomínio). */
export const TENANT_PICKER_PATH = "/imobiliarias"

/** Tela "Você não tem acesso a esta imobiliária" no subdomínio. */
export const ACCESS_DENIED_PATH = "/sem-acesso"

/**
 * Página intermediária dos links com `token_hash` (/auth/confirm): o token só
 * é consumido depois do clique em "Continuar". Pública pelo prefixo "/auth".
 */
export const CONFIRM_LINK_PATH = "/auth/confirmar"

/** Prefixo das páginas públicas de convite (ver lib/configuracoes/invitations.ts). */
export const INVITATION_PATH_PREFIX = "/convite/"

/** Página pública de planos (Pagamentos/Assinatura): domínio raiz e host único. */
export const PLANS_PATH = "/planos"

/** Assinatura da imobiliária no CRM (rota normal, com membership). */
export const SUBSCRIPTION_SETTINGS_PATH = "/configuracoes/assinatura"

/**
 * Webhooks de serviços externos (ex.: Stripe). Públicos e sem sessão em
 * qualquer host: a autenticidade é conferida pela assinatura do provedor.
 */
export const WEBHOOKS_PATH_PREFIX = "/api/webhooks"

/**
 * Tarefas agendadas (Vercel Cron). Públicas e sem sessão em qualquer host: cada
 * rota confere `Authorization: Bearer CRON_SECRET`.
 */
export const CRON_PATH_PREFIX = "/api/cron"

const PUBLIC_PATHS = new Set([
  LOGIN_PATH,
  SIGN_UP_PATH,
  RECOVER_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  PLANS_PATH,
])

/** `/lp` são as landing pages públicas das imobiliárias (tráfego pago e redes sociais). */
const PUBLIC_PREFIXES = [
  "/auth",
  "/captar",
  "/api/feeds",
  WEBHOOKS_PATH_PREFIX,
  CRON_PATH_PREFIX,
  "/convite",
  "/lp",
]

/** Rotas que só fazem sentido para quem ainda não entrou. */
const GUEST_ONLY_PATHS = new Set([LOGIN_PATH, SIGN_UP_PATH, RECOVER_PASSWORD_PATH])

/** Rotas atendidas só no domínio raiz: no subdomínio, redirecionam para a raiz. */
const ROOT_ONLY_PREFIXES = [ONBOARDING_PATH, TENANT_PICKER_PATH, PLANS_PATH]

/**
 * Rotas que o domínio raiz atende. As demais (CRM) levam à escolha de
 * imobiliária. /convite e o feed antigo continuam válidos na raiz por
 * compatibilidade com links já compartilhados.
 */
const ROOT_HOST_PREFIXES = [
  ...PUBLIC_PATHS,
  "/auth",
  "/convite",
  "/api/feeds",
  WEBHOOKS_PATH_PREFIX,
  CRON_PATH_PREFIX,
  ...ROOT_ONLY_PREFIXES,
]

/**
 * Primeiro segmento aceito em `next` (allowlist): seções do CRM e fluxos de
 * conta. Ao criar uma seção nova no topo do app, inclua-a aqui; fora da lista,
 * o login leva ao destino padrão. Subpáginas herdam a seção (ex.:
 * /configuracoes/assinatura entra por "configuracoes").
 */
const REDIRECT_ALLOWED_SECTIONS = new Set([
  "agenda",
  "captacao",
  "chaves",
  "clientes",
  "condominios",
  "configuracoes",
  "imoveis",
  "leads",
  "marketing",
  "painel",
  "perfil",
  "propostas",
  "tarefas",
  "onboarding",
  "imobiliarias",
  "convite",
  "redefinir-senha",
  "sem-acesso",
])

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

  return PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((prefix) => matchesPrefix(path, prefix))
}

/** Webhooks: sem sessão, sem tenant e sem redirecionamentos, em qualquer host. */
export function isWebhookPath(pathname: string) {
  return matchesPrefix(normalizePathname(pathname), WEBHOOKS_PATH_PREFIX)
}

/** Tarefas agendadas: sem sessão, sem tenant e sem redirecionamentos, em qualquer host. */
export function isCronPath(pathname: string) {
  return matchesPrefix(normalizePathname(pathname), CRON_PATH_PREFIX)
}

export function isGuestOnlyPath(pathname: string) {
  return GUEST_ONLY_PATHS.has(normalizePathname(pathname))
}

export function isRootOnlyPath(pathname: string) {
  const path = normalizePathname(pathname)
  return ROOT_ONLY_PREFIXES.some((prefix) => matchesPrefix(path, prefix))
}

export function isRootHostPath(pathname: string) {
  const path = normalizePathname(pathname)
  return ROOT_HOST_PREFIXES.some((prefix) => matchesPrefix(path, prefix))
}

/**
 * Aceita apenas caminhos relativos do próprio app (evita open redirect), cujo
 * primeiro segmento está na allowlist, e nunca devolve rotas que levariam a um
 * loop (login, cadastro, /auth/*).
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

    const section = url.pathname.split("/")[1] ?? ""

    if (!REDIRECT_ALLOWED_SECTIONS.has(section)) {
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
