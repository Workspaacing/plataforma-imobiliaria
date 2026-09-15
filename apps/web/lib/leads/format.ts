import { onlyDigits } from "@workspace/core/br/documents"

import type { Json } from "@workspace/database/types"

import { formatDate } from "@/lib/format"
import { formatPhoneDisplay } from "@/lib/captacao/masks"
import { LEAD_RESPONSE_TARGET_MINUTES } from "@/lib/leads/constants"
import type { LeadStage } from "@/lib/leads/db-types"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// -----------------------------------------------------------------------------
// Tempo relativo ("há 2 h")
// -----------------------------------------------------------------------------

/** "agora", "há 5 min", "há 2 h", "há 3 d" ou a data (a partir de 30 dias). */
export function formatRelativeShort(iso: string, nowMs: number) {
  const time = Date.parse(iso)

  if (Number.isNaN(time)) return "—"

  const elapsed = Math.max(0, nowMs - time)

  if (elapsed < MINUTE) return "agora"
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`
  if (elapsed < DAY) return `há ${Math.floor(elapsed / HOUR)} h`
  if (elapsed < 30 * DAY) return `há ${Math.floor(elapsed / DAY)} d`

  return `em ${formatDate(iso)}`
}

/** Tempo decorrido curto para cronômetros: "menos de 1 min", "4 min", "2 h", "3 d". */
export function formatElapsedShort(iso: string, nowMs: number) {
  const time = Date.parse(iso)

  if (Number.isNaN(time)) return "—"

  const elapsed = Math.max(0, nowMs - time)

  if (elapsed < MINUTE) return "menos de 1 min"
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h`

  return `${Math.floor(elapsed / DAY)} d`
}

/** Lead em "Novo" ainda sem nenhum contato registrado (cronômetro rodando). */
export function isLeadWithoutContact(lead: { stage: LeadStage; lastContactAt: string | null }) {
  return lead.stage === "new" && !lead.lastContactAt
}

/** Lead novo, sem contato registrado e fora da meta de primeiro contato. */
export function isLeadAwaitingContact(
  lead: { stage: LeadStage; lastContactAt: string | null; createdAt: string },
  nowMs: number
) {
  if (lead.stage !== "new" || lead.lastContactAt) {
    return false
  }

  const created = Date.parse(lead.createdAt)
  return !Number.isNaN(created) && nowMs - created > LEAD_RESPONSE_TARGET_MINUTES * MINUTE
}

// -----------------------------------------------------------------------------
// Contato
// -----------------------------------------------------------------------------

/** Dígitos do telefone brasileiro, sem o 55 do país quando vier junto. */
export function leadPhoneDigits(value: string | null | undefined) {
  let digits = onlyDigits(value ?? "")

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2)
  }

  return digits
}

export function formatLeadPhone(value: string | null | undefined) {
  const digits = leadPhoneDigits(value)
  return digits ? (formatPhoneDisplay(digits) ?? digits) : null
}

/** Telefone mascarado para listas (LGPD): "(11) *****-4321". */
export function maskLeadPhone(value: string | null | undefined) {
  const digits = leadPhoneDigits(value)

  if (digits.length < 10) {
    return digits ? "***" : null
  }

  const hidden = "*".repeat(digits.length - 6)
  return `(${digits.slice(0, 2)}) ${hidden}-${digits.slice(-4)}`
}

export function leadWhatsappHref(value: string | null | undefined) {
  const digits = leadPhoneDigits(value)
  return digits.length === 10 || digits.length === 11 ? `https://wa.me/55${digits}` : null
}

export function leadTelHref(value: string | null | undefined) {
  const digits = leadPhoneDigits(value)
  return digits.length === 10 || digits.length === 11 ? `tel:+55${digits}` : null
}

export function leadMailtoHref(email: string | null | undefined, subject?: string) {
  if (!email) return null

  const address = encodeURIComponent(email.trim())
  return subject ? `mailto:${address}?subject=${encodeURIComponent(subject)}` : `mailto:${address}`
}

/** Celular brasileiro (11 dígitos com 9 após o DDD): provável WhatsApp. */
export function isMobilePhone(value: string | null | undefined) {
  const digits = leadPhoneDigits(value)
  return digits.length === 11 && digits[2] === "9"
}

// -----------------------------------------------------------------------------
// UTM
// -----------------------------------------------------------------------------

export const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const

export type UtmKey = (typeof UTM_KEYS)[number]
export type LeadUtm = Partial<Record<UtmKey, string>>

export const UTM_LABELS: Record<UtmKey, string> = {
  source: "Fonte (utm_source)",
  medium: "Mídia (utm_medium)",
  campaign: "Campanha (utm_campaign)",
  content: "Conteúdo (utm_content)",
  term: "Termo (utm_term)",
}

// -----------------------------------------------------------------------------
// Possível duplicado (chaves de comparação)
// -----------------------------------------------------------------------------

/** Só dígitos, sem o 55 do país, últimos 11; null se não parece telefone. */
export function duplicatePhoneKey(value: string | null | undefined) {
  const digits = leadPhoneDigits(value).slice(-11)
  return digits.length >= 10 ? digits : null
}

/** E-mail minúsculo e sem espaços; null se vazio. */
export function duplicateEmailKey(value: string | null | undefined) {
  const email = (value ?? "").replace(/\s+/g, "").toLowerCase()
  return email.includes("@") ? email : null
}

// -----------------------------------------------------------------------------
// Anúncios (click ids)
// -----------------------------------------------------------------------------

export const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "fbc", "fbp"] as const

export type ClickIdKey = (typeof CLICK_ID_KEYS)[number]
export type LeadClickIds = Partial<Record<ClickIdKey, string>>

export type LeadAdPlatform = "google_ads" | "meta_ads"

export const LEAD_AD_PLATFORM_LABELS: Record<LeadAdPlatform, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
}

/** Parâmetros de URL que carregam identificadores de clique de anúncio. */
const CLICK_ID_URL_PARAMS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "dclid"] as const

/** Lê `leads.click_ids` (jsonb) aceitando só strings não vazias. */
export function readLeadClickIds(value: Json | null | undefined): LeadClickIds {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const clickIds: LeadClickIds = {}

  for (const key of CLICK_ID_KEYS) {
    const raw = value[key]

    if (typeof raw === "string" && raw.trim()) {
      clickIds[key] = raw.trim().slice(0, 500)
    }
  }

  return clickIds
}

/** Click ids presentes na query string da URL de entrada (quando `click_ids` não veio). */
export function readClickIdsFromUrl(url: string | null | undefined): LeadClickIds {
  if (!url) return {}

  try {
    const params = new URL(url).searchParams
    const clickIds: LeadClickIds = {}

    for (const key of ["gclid", "gbraid", "wbraid", "fbclid"] as const) {
      const raw = params.get(key)
      if (raw) clickIds[key] = raw.slice(0, 500)
    }

    return clickIds
  } catch {
    return {}
  }
}

/** Google Ads pela presença de gclid/gbraid/wbraid; Meta Ads por fbclid/fbc. */
export function detectAdPlatforms(clickIds: LeadClickIds): LeadAdPlatform[] {
  const platforms: LeadAdPlatform[] = []

  if (clickIds.gclid || clickIds.gbraid || clickIds.wbraid) platforms.push("google_ads")
  if (clickIds.fbclid || clickIds.fbc) platforms.push("meta_ads")

  return platforms
}

/** Remove da URL os parâmetros de click id (para quem não pode ver os ids crus). */
export function stripClickIdParams(url: string | null | undefined) {
  if (!url) return null

  try {
    const parsed = new URL(url)

    for (const key of CLICK_ID_URL_PARAMS) {
      parsed.searchParams.delete(key)
    }

    return parsed.toString()
  } catch {
    return null
  }
}

/** URL http(s) segura para virar link; senão null. */
export function safeHttpUrl(url: string | null | undefined) {
  if (!url) return null

  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null
  } catch {
    return null
  }
}

/** Lê `leads.utm` (jsonb) aceitando só strings não vazias. */
export function readLeadUtm(value: Json | null | undefined): LeadUtm {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const utm: LeadUtm = {}

  for (const key of UTM_KEYS) {
    const raw = value[key] ?? value[`utm_${key}`]

    if (typeof raw === "string" && raw.trim()) {
      utm[key] = raw.trim().slice(0, 200)
    }
  }

  return utm
}
