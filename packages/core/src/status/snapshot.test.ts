import { readdirSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { STATUS_COMPONENT_KEYS, STATUS_COMPONENTS } from "./public"
import { parsePublicStatusSnapshot } from "./snapshot"

function day(date: string, overrides: Record<string, unknown> = {}) {
  return { date, uptimePct: 100, worstLevel: "operational", incidentIds: [], ...overrides }
}

function rpcSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-09-17T12:00:00.123456+00:00",
    lastCheckedAt: "2026-09-17T11:59:00+00:00",
    overall: "operational",
    components: STATUS_COMPONENT_KEYS.map((key) => ({
      key,
      name: "nome do banco",
      description: "descrição do banco",
      level: key === "integrations" ? "partial_outage" : "operational",
      uptime90dPct: key === "billing" ? null : 99.95,
      days: [day("2026-09-16"), day("2026-09-17", { uptimePct: 80, worstLevel: "partial_outage" })],
    })),
    activeIncidents: [
      {
        id: "b4161c17-bbcf-4e16-ae8e-25f391263f7b",
        kind: "incident",
        title: "Portais atrasados",
        impact: "major",
        status: "identified",
        componentKeys: ["integrations"],
        startedAt: "2026-09-17T11:00:00+00:00",
        resolvedAt: null,
        scheduledFor: null,
        scheduledUntil: null,
        updates: [
          {
            status: "identified",
            message: "Causa encontrada.\nCorrigindo.",
            createdAt: "2026-09-17T11:30:00+00:00",
          },
        ],
      },
    ],
    upcomingMaintenances: [],
    pastIncidents: [],
    ...overrides,
  }
}

describe("parsePublicStatusSnapshot", () => {
  it("aceita o formato da RPC e usa nome e descrição do core, na ordem da página", () => {
    const snapshot = parsePublicStatusSnapshot(rpcSnapshot())

    expect(snapshot).not.toBeNull()
    expect(snapshot?.components.map((component) => component.key)).toEqual([
      ...STATUS_COMPONENT_KEYS,
    ])
    expect(snapshot?.components[0]?.name).toBe(STATUS_COMPONENTS[0]?.name)
    expect(snapshot?.components[0]?.description).toBe(STATUS_COMPONENTS[0]?.description)
    expect(snapshot?.activeIncidents[0]?.updates[0]?.message).toBe("Causa encontrada.\nCorrigindo.")
  })

  it("recalcula a situação geral a partir das partes", () => {
    expect(parsePublicStatusSnapshot(rpcSnapshot({ overall: "operational" }))?.overall).toBe(
      "partial_outage"
    )
  })

  it("descarta campos fora do contrato (nada interno passa adiante)", () => {
    const raw = rpcSnapshot()
    const withExtras = {
      ...raw,
      created_by: "00000000-0000-0000-0000-000000000000",
      components: raw.components.map((component) => ({ ...component, detail: "http_503" })),
      activeIncidents: raw.activeIncidents.map((incident) => ({
        ...incident,
        createdBy: "alguem",
      })),
    }
    const text = JSON.stringify(parsePublicStatusSnapshot(withExtras))

    expect(text).not.toContain("created_by")
    expect(text).not.toContain("http_503")
    expect(text).not.toContain("createdBy")
  })

  it("formato inesperado vira null", () => {
    expect(parsePublicStatusSnapshot(null)).toBeNull()
    expect(parsePublicStatusSnapshot({})).toBeNull()
    expect(parsePublicStatusSnapshot(rpcSnapshot({ overall: "down" }))).toBeNull()
    expect(
      parsePublicStatusSnapshot(
        rpcSnapshot({ components: rpcSnapshot().components.filter((c) => c.key !== "billing") })
      )
    ).toBeNull()
    expect(
      parsePublicStatusSnapshot(
        rpcSnapshot({
          components: rpcSnapshot().components.map((c) => ({ ...c, uptime90dPct: 120 })),
        })
      )
    ).toBeNull()
  })
})

describe("migração da página de status", () => {
  const migrationsDir = new URL("../../../../supabase/migrations/", import.meta.url)
  const file = readdirSync(migrationsDir).find((name) => name.endsWith("_status_page_public.sql"))
  const sql = file ? readFileSync(new URL(file, migrationsDir), "utf8") : ""

  it("existe", () => {
    expect(file).toBeDefined()
  })

  it("tem as mesmas partes do core, na mesma ordem", () => {
    const match =
      /create or replace function private\.status_component_keys\(\)[\s\S]*?array\[([\s\S]*?)\]::text\[\]/.exec(
        sql
      )
    const keys = [...(match?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((entry) => entry[1])

    expect(keys).toEqual([...STATUS_COMPONENT_KEYS])
  })

  it("devolve os mesmos nomes e descrições do core", () => {
    for (const component of STATUS_COMPONENTS) {
      expect(sql).toContain(`('${component.key}', '${component.name}', '${component.description}')`)
    }
  })
})
