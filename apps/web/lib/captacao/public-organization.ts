import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cache } from "react"
import { z } from "zod"

import type { Database } from "@workspace/database/types"

import { readOrganizationBrand, type OrganizationBrand } from "@/lib/configuracoes/brand"
import { getSupabaseEnv, SupabaseNotConfiguredError } from "@/lib/supabase/env"

/**
 * Cliente Supabase anônimo (sem cookies nem sessão) para as páginas públicas.
 * Só chama RPCs liberadas para `anon`.
 */
export function createAnonClient() {
  const env = getSupabaseEnv()

  if (!env) {
    throw new SupabaseNotConfiguredError()
  }

  return createSupabaseClient<Database>(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export type PublicOrganization = {
  slug: string
  name: string
  city: string | null
  state: string | null
  phone: string | null
  email: string | null
  creci: string | null
  /** Contrato do módulo de Configurações: primary_color (hex) e logo_url (https). */
  brand: OrganizationBrand
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const organizationSchema = z.object({
  name: z.string().min(1),
  city: z.string().nullish(),
  state: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  creci: z.string().nullish(),
  brand: z.unknown(),
})

export function normalizeSlug(value: string) {
  let decoded = value

  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null
  }

  const slug = decoded.trim().toLowerCase()
  return slug.length >= 3 && slug.length <= 48 && SLUG_PATTERN.test(slug) ? slug : null
}

function clean(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null
}

/** Dados públicos da imobiliária pelo slug; null se não existir. Memoizado por requisição. */
export const getPublicOrganization = cache(
  async (rawSlug: string): Promise<PublicOrganization | null> => {
    const slug = normalizeSlug(rawSlug)

    if (!slug) {
      return null
    }

    const supabase = createAnonClient()
    const { data, error } = await supabase.rpc("get_public_organization", { p_slug: slug })

    if (error) {
      throw new Error(`Não foi possível carregar a imobiliária (${error.code ?? "erro"}).`)
    }

    const parsed = organizationSchema.safeParse(data)

    if (!parsed.success) {
      return null
    }

    const organization = parsed.data

    return {
      slug,
      name: organization.name.trim(),
      city: clean(organization.city),
      state: clean(organization.state),
      phone: clean(organization.phone),
      email: clean(organization.email),
      creci: clean(organization.creci),
      brand: readOrganizationBrand(organization.brand),
    }
  }
)
