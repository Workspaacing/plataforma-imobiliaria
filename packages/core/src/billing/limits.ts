// Limites numéricos por plano e leitura de uso para medidores e avisos.
// Convenção (igual ao jsonb `limits` em billing_accounts): -1 = ilimitado,
// 0 = não incluso. O banco só aplica `users` e `landing_pages`; os demais
// são exibidos e passam a valer quando os módulos existirem.

import type { FeatureStatus } from "./features"
import { PLANS, clampExtraSeats, type PlanKey } from "./plans"

export const LIMIT_KEYS = [
  "users",
  "landing_pages",
  "owned_listings",
  "photos_per_listing",
  "pipelines",
  "ai_conversations",
  "whatsapp_numbers",
  "rental_contracts",
  "esign_docs",
  "branches",
] as const

export type LimitKey = (typeof LIMIT_KEYS)[number]

export const UNLIMITED = -1

/** A partir desta fração de uso a assinatura sugere upgrade. */
export const USAGE_WARNING_RATIO = 0.8

export type LimitDefinition = {
  label: string
  unit?: string
  status: FeatureStatus
  /** true quando o banco bloqueia acima do limite. */
  enforced: boolean
}

export const LIMITS: Record<LimitKey, LimitDefinition> = {
  users: { label: "Usuários", status: "available", enforced: true },
  landing_pages: { label: "Landing pages publicadas", status: "available", enforced: true },
  owned_listings: {
    label: "Imóveis próprios (com fotos hospedadas por nós)",
    status: "available",
    enforced: false,
  },
  photos_per_listing: { label: "Fotos por imóvel próprio", status: "available", enforced: false },
  pipelines: { label: "Funis de leads", status: "soon", enforced: false },
  ai_conversations: {
    label: "Conversas de IA no WhatsApp por mês",
    status: "soon",
    enforced: false,
  },
  whatsapp_numbers: { label: "Números de WhatsApp oficial", status: "soon", enforced: false },
  rental_contracts: { label: "Contratos de locação ativos", status: "soon", enforced: false },
  esign_docs: {
    label: "Documentos com assinatura eletrônica por mês",
    status: "soon",
    enforced: false,
  },
  branches: { label: "Lojas ou imobiliárias", status: "soon", enforced: false },
}

/**
 * Limites gravados em billing_accounts.limits: os do plano, com
 * `users` = incluídos + extras contratados, capado por usersMax.
 */
export function computeLimits(plan: PlanKey, extraSeats: number): Record<LimitKey, number> {
  const definition = PLANS[plan]

  return {
    ...definition.limits,
    users: definition.usersIncluded + clampExtraSeats(plan, extraSeats),
  }
}

export function isUnlimited(limit: number): boolean {
  return limit < 0
}

/** Uso acima do limite (ex.: depois de um downgrade). Ilimitado nunca estoura. */
export function isOverLimit(limit: number, used: number): boolean {
  return !isUnlimited(limit) && used > limit
}

/** Uso no limite ou acima: não cabe mais um item. */
export function isAtLimit(limit: number, used: number): boolean {
  return !isUnlimited(limit) && used >= limit
}

/**
 * Fração de uso para medidores (pode passar de 1).
 * - ilimitado (-1) → null;
 * - não incluso (0) → 0 sem uso, Infinity com uso;
 * - uso negativo conta como 0.
 */
export function usageRatio(limit: number, used: number): number | null {
  if (isUnlimited(limit)) {
    return null
  }

  const safeUsed = Math.max(0, used)

  if (limit === 0) {
    return safeUsed > 0 ? Number.POSITIVE_INFINITY : 0
  }

  return safeUsed / limit
}

/** Uso ≥ 80% do limite: momento de sugerir upgrade. */
export function isNearLimit(limit: number, used: number): boolean {
  const ratio = usageRatio(limit, used)
  return ratio !== null && ratio >= USAGE_WARNING_RATIO
}
