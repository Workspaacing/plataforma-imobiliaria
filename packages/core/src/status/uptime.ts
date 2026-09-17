/**
 * Página de status — disponibilidade (uptime).
 *
 * O banco guarda por parte e por dia (calendário de São Paulo) quantas
 * medições automáticas houve e quantas estavam "no ar" (operacional ou
 * lentidão). Disponibilidade = no ar ÷ total, em %, com até 2 casas; sem
 * medição, null (a barra fica cinza, nunca vermelha). Espelho de
 * `public.get_public_status`.
 */

import type { StatusDay } from "./public"

/** Dias mostrados na barra de disponibilidade. */
export const STATUS_HISTORY_DAYS = 90

/** Dias de incidentes resolvidos listados na página. */
export const STATUS_PAST_INCIDENT_DAYS = 14

export const STATUS_TIME_ZONE = "America/Sao_Paulo"

/** Arredonda para até 2 casas (0,005 sobe), sem passar de 0–100. */
export function roundUptimePct(value: number): number {
  const clamped = Math.min(100, Math.max(0, value))
  return Math.round((clamped + Number.EPSILON) * 100) / 100
}

/**
 * Disponibilidade em % a partir das medições boas e do total; null sem
 * medição (ou com números inválidos). Nunca devolve 100 quando houve falha:
 * 99,999% vira 99,99%.
 */
export function uptimePct(good: number, total: number): number | null {
  if (!Number.isFinite(good) || !Number.isFinite(total) || total <= 0 || good < 0) {
    return null
  }

  const safeGood = Math.min(good, total)

  if (safeGood === total) {
    return 100
  }

  // Multiplica antes de dividir: com inteiros, o resultado exato não sofre erro
  // de ponto flutuante antes do corte (igual ao floor(...)/100 do banco).
  return roundUptimePct(Math.floor((safeGood * 10000) / total) / 100)
}

export type DailyUptimeCounts = { good: number; total: number }

/** Disponibilidade de um período (soma dos dias); null se não houve medição. */
export function periodUptimePct(
  days: Iterable<DailyUptimeCounts | null | undefined>
): number | null {
  let good = 0
  let total = 0

  for (const day of days) {
    if (day && Number.isFinite(day.good) && Number.isFinite(day.total) && day.total > 0) {
      good += Math.min(Math.max(day.good, 0), day.total)
      total += day.total
    }
  }

  return uptimePct(good, total)
}

const DAY_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: STATUS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** "AAAA-MM-DD" do instante no calendário de São Paulo; null se inválido. */
export function statusDayKey(value: Date | string | number): string | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : DAY_KEY_FORMAT.format(date)
}

/**
 * Os `count` dias do calendário de São Paulo terminando no dia de `now`, do
 * mais antigo para o mais recente.
 */
export function statusDayKeys(now: Date, count: number = STATUS_HISTORY_DAYS): string[] {
  const today = statusDayKey(now)

  if (!today || count <= 0) {
    return []
  }

  const [year, month, day] = today.split("-").map(Number) as [number, number, number]
  const keys: string[] = []

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(new Date(Date.UTC(year, month - 1, day - offset)).toISOString().slice(0, 10))
  }

  return keys
}

/** Resumo de "X de Y dias sem problema" para a legenda da barra. */
export function countDaysWithoutProblems(days: readonly StatusDay[]): number {
  return days.filter(
    (day) => day.worstLevel === "operational" || day.worstLevel === "under_maintenance"
  ).length
}
