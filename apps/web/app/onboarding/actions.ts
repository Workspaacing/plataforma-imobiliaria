"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import {
  isBrazilianState,
  isValidCnpj,
  normalizeCnpj,
  organizationSchema,
  toTitleCase,
  type BrazilianStateCode,
  type OrganizationValues,
} from "@/app/onboarding/schema"
import {
  ORGANIZATION_COOKIE_NAME,
  ORGANIZATION_COOKIE_OPTIONS,
} from "@/lib/auth/organization-cookie"
import { HOME_PATH, LOGIN_PATH, ONBOARDING_PATH } from "@/lib/auth/routes"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export type OrganizationFieldErrors = Partial<
  Record<keyof OrganizationValues, string>
>

export type CreateOrganizationResult = {
  ok: false
  error: string
  fieldErrors?: OrganizationFieldErrors
}

export type CnpjLookupResult =
  | {
      ok: true
      data: {
        legalName: string
        tradeName: string | null
        city: string | null
        state: BrazilianStateCode | null
      }
      warning?: string
    }
  | { ok: false; error: string }

type DatabaseError = {
  code?: string
  message: string
  details?: string | null
}

function mapCreateOrganizationError(error: DatabaseError): CreateOrganizationResult {
  const context = `${error.message} ${error.details ?? ""}`.toLowerCase()

  switch (error.code) {
    case "23505":
      return context.includes("cnpj")
        ? {
            ok: false,
            error: "Já existe uma imobiliária cadastrada com este CNPJ.",
            fieldErrors: { cnpj: "Já existe uma imobiliária com este CNPJ." },
          }
        : {
            ok: false,
            error: "Este endereço já está em uso.",
            fieldErrors: { slug: "Este endereço já está em uso. Escolha outro." },
          }
    case "PGRST202":
    case "42883":
      return {
        ok: false,
        error:
          "O banco ainda não tem a função create_organization. Aplique as migrações do Supabase e tente de novo.",
      }
    case "42501":
      return {
        ok: false,
        error: "Sua conta não tem permissão para criar imobiliárias.",
      }
    // Validações da própria função (mensagens já em pt-BR).
    case "22023":
    case "P0001":
      return { ok: false, error: error.message }
    default:
      return {
        ok: false,
        error: "Não foi possível criar a imobiliária agora. Tente novamente.",
      }
  }
}

export async function createOrganization(
  values: OrganizationValues
): Promise<CreateOrganizationResult> {
  const parsed = organizationSchema.safeParse(values)

  if (!parsed.success) {
    const fieldErrors: OrganizationFieldErrors = {}
    const flattened = z.flattenError(parsed.error)

    for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
      const message = (messages as string[] | undefined)?.[0]

      if (message) {
        fieldErrors[field as keyof OrganizationValues] = message
      }
    }

    return { ok: false, error: "Confira os campos destacados.", fieldErrors }
  }

  const user = await getCurrentUser()

  if (!user) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(ONBOARDING_PATH)}`)
  }

  const { name, slug, legalName, cnpj, creci, city, state } = parsed.data
  const supabase = await createClient()

  // A função cria a organização e a membership de dono na mesma transação.
  const { data: organizationId, error } = await supabase.rpc(
    "create_organization",
    {
      p_name: name,
      p_slug: slug,
      p_legal_name: legalName,
      // Parâmetros com DEFAULT NULL na função: omitir em vez de enviar null.
      p_cnpj: cnpj ? normalizeCnpj(cnpj) : undefined,
      p_creci: creci,
      p_city: city,
      p_state: state,
    }
  )

  if (error) {
    return mapCreateOrganizationError(error)
  }

  if (typeof organizationId !== "string") {
    return {
      ok: false,
      error: "A imobiliária foi criada, mas não recebemos o identificador. Recarregue a página.",
    }
  }

  const cookieStore = await cookies()
  cookieStore.set(ORGANIZATION_COOKIE_NAME, organizationId, ORGANIZATION_COOKIE_OPTIONS)

  revalidatePath("/", "layout")
  redirect(HOME_PATH)
}

const brasilApiCnpjSchema = z.object({
  razao_social: z.string().min(1),
  nome_fantasia: z.string().nullish(),
  municipio: z.string().nullish(),
  uf: z.string().nullish(),
  descricao_situacao_cadastral: z.string().nullish(),
})

const CNPJ_LOOKUP_TIMEOUT_MS = 8000

/** Consulta a BrasilAPI no servidor (evita CORS e expõe só o necessário). */
export async function lookupCnpj(value: string): Promise<CnpjLookupResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente." }
  }

  const cnpj = normalizeCnpj(value)

  if (!isValidCnpj(cnpj)) {
    return { ok: false, error: "CNPJ inválido. Confira os números." }
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(CNPJ_LOOKUP_TIMEOUT_MS),
    })

    if (response.status === 404) {
      return {
        ok: false,
        error: "CNPJ não encontrado na Receita Federal. Preencha os dados manualmente.",
      }
    }

    if (response.status === 429) {
      return {
        ok: false,
        error: "Muitas consultas seguidas. Aguarde um minuto e tente de novo.",
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        error: "A consulta de CNPJ está indisponível no momento. Preencha os dados manualmente.",
      }
    }

    const parsed = brasilApiCnpjSchema.safeParse(await response.json())

    if (!parsed.success) {
      return {
        ok: false,
        error: "A consulta de CNPJ respondeu num formato inesperado. Preencha os dados manualmente.",
      }
    }

    const company = parsed.data
    const uf = company.uf?.trim().toUpperCase() ?? null
    const situation = company.descricao_situacao_cadastral?.trim().toUpperCase()

    return {
      ok: true,
      data: {
        legalName: company.razao_social.trim(),
        tradeName: company.nome_fantasia?.trim()
          ? toTitleCase(company.nome_fantasia.trim())
          : null,
        city: company.municipio?.trim() ? toTitleCase(company.municipio.trim()) : null,
        state: isBrazilianState(uf) ? uf : null,
      },
      warning:
        situation && situation !== "ATIVA"
          ? `Atenção: a situação cadastral deste CNPJ é "${toTitleCase(situation)}".`
          : undefined,
    }
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return {
        ok: false,
        error: "A consulta de CNPJ demorou demais. Tente de novo ou preencha manualmente.",
      }
    }

    return {
      ok: false,
      error: "Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.",
    }
  }
}
