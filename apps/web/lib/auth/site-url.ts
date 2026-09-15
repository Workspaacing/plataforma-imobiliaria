import "server-only"

const DEVELOPMENT_SITE_URL = "http://localhost:3000"

/**
 * Origem pública do app (sem barra final), usada nos links enviados por e-mail
 * (confirmação, link mágico, recuperação de senha, convites) e nos
 * redirecionamentos de /auth.
 *
 * Vem só de NEXT_PUBLIC_SITE_URL, nunca dos headers da requisição (Origin,
 * Host, X-Forwarded-Host): eles podem ser forjados para fazer um link de
 * recuperação apontar para o domínio de um atacante.
 *
 * A URL precisa estar na lista de "Redirect URLs" do Supabase; caso contrário
 * ele usa o Site URL do projeto.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (configured) {
    return parseSiteUrl(configured)
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL não está definida. Em produção ela é obrigatória: informe a URL pública do app (ex.: https://crm.suaimobiliaria.com.br), sem barra no final."
    )
  }

  return DEVELOPMENT_SITE_URL
}

function parseSiteUrl(value: string) {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL é inválida. Use uma URL absoluta, como https://crm.suaimobiliaria.com.br."
    )
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SITE_URL precisa começar com https:// ou http://.")
  }

  // `origin` nunca tem barra final, caminho ou query.
  return url.origin
}

export function buildAuthCallbackUrl(
  siteUrl: string,
  next: string,
  extraParams: Record<string, string> = {}
) {
  const url = new URL("/auth/callback", siteUrl)
  url.searchParams.set("next", next)

  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value)
  }

  return url.toString()
}
