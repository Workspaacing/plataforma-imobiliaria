import { describe, expect, it } from "vitest"

import {
  countDaysWithoutProblems,
  periodUptimePct,
  STATUS_HISTORY_DAYS,
  statusDayKey,
  statusDayKeys,
  uptimePct,
} from "./uptime"

describe("uptimePct", () => {
  it("sem medição é null (barra cinza, nunca vermelha)", () => {
    expect(uptimePct(0, 0)).toBeNull()
    expect(uptimePct(Number.NaN, 10)).toBeNull()
    expect(uptimePct(-1, 10)).toBeNull()
  })

  it("tudo no ar é 100", () => {
    expect(uptimePct(1440, 1440)).toBe(100)
  })

  it("trunca em 2 casas e nunca arredonda uma falha para 100", () => {
    expect(uptimePct(4, 5)).toBe(80)
    expect(uptimePct(99999, 100000)).toBe(99.99)
    expect(uptimePct(1439, 1440)).toBe(99.93)
    expect(uptimePct(2, 3)).toBe(66.66)
  })

  it("não passa de 100 com contagem inconsistente", () => {
    expect(uptimePct(12, 10)).toBe(100)
  })
})

describe("periodUptimePct", () => {
  it("soma os dias com medição e ignora os sem", () => {
    expect(
      periodUptimePct([
        { good: 1440, total: 1440 },
        null,
        { good: 0, total: 0 },
        { good: 720, total: 1440 },
      ])
    ).toBe(75)
    expect(periodUptimePct([null, undefined])).toBeNull()
  })
})

describe("dias do calendário de São Paulo", () => {
  it("usa o dia de São Paulo, não o de UTC", () => {
    // 02:30 UTC ainda é 23:30 do dia anterior em São Paulo.
    expect(statusDayKey("2026-09-17T02:30:00Z")).toBe("2026-09-16")
    expect(statusDayKey("2026-09-17T03:30:00Z")).toBe("2026-09-17")
    expect(statusDayKey("não é data")).toBeNull()
  })

  it("90 dias terminando hoje, do mais antigo para o mais recente", () => {
    const keys = statusDayKeys(new Date("2026-09-17T12:00:00Z"))
    expect(keys).toHaveLength(STATUS_HISTORY_DAYS)
    expect(keys[0]).toBe("2026-06-20")
    expect(keys.at(-1)).toBe("2026-09-17")
    expect(new Set(keys).size).toBe(STATUS_HISTORY_DAYS)
  })

  it("atravessa virada de mês e de ano", () => {
    expect(statusDayKeys(new Date("2027-01-01T12:00:00Z"), 3)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ])
    expect(statusDayKeys(new Date("2027-01-01T12:00:00Z"), 0)).toEqual([])
  })
})

describe("countDaysWithoutProblems", () => {
  it("manutenção não conta como problema", () => {
    expect(
      countDaysWithoutProblems([
        { date: "2026-09-15", uptimePct: 100, worstLevel: "operational", incidentIds: [] },
        {
          date: "2026-09-16",
          uptimePct: null,
          worstLevel: "under_maintenance",
          incidentIds: ["a"],
        },
        { date: "2026-09-17", uptimePct: 98.5, worstLevel: "partial_outage", incidentIds: [] },
      ])
    ).toBe(2)
  })
})
