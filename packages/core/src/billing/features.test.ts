import { describe, expect, it } from "vitest"

import {
  FEATURE_GROUPS,
  FEATURE_KEYS,
  FEATURES,
  featuresForPlan,
  isFeatureKey,
  planHasFeature,
  type FeatureKey,
} from "./features"
import { PLAN_KEYS, type BillingPlanKey } from "./plans"

// Lista literal da pesquisa de preços, §5.3. Nenhuma chave fora dela.
const RESEARCH_FEATURE_KEYS = [
  "feature_properties",
  "feature_condominiums",
  "feature_listing_score",
  "feature_capture_public_form",
  "feature_keys",
  "feature_proposals",
  "feature_clients",
  "feature_calendar_tasks",
  "feature_leads_kanban",
  "feature_multiple_pipelines",
  "feature_landing_pages",
  "feature_portal_feed_vrsync",
  "feature_team_roles_invites",
  "feature_tenant_subdomain",
  "feature_custom_domain",
  "feature_multi_branch",
  "feature_data_export",
  "feature_assisted_migration",
  "feature_ai_whatsapp",
  "feature_whatsapp_official_inbox",
  "feature_lead_roulette_sla",
  "feature_portal_leads_ingest",
  "feature_meta_lead_ads",
  "feature_portal_health",
  "feature_portal_health_alerts",
  "feature_pwa_push",
  "feature_instagram_publish",
  "feature_instagram_inbox",
  "feature_whatsapp_broadcast",
  "feature_document_inbox_email",
  "feature_maps",
  "feature_esignature",
  "feature_property_client_match",
  "feature_bi_goals",
  "feature_launches",
  "feature_api_read",
  "feature_api_full",
  "feature_webhooks",
  "feature_rental_contracts",
  "feature_rental_billing_boleto_pix",
  "feature_rental_owner_payout",
  "feature_rental_adjustment",
  "feature_dimob",
  "feature_nfse",
  "feature_creci_compliance",
  "feature_lgpd_consent_audit",
  "feature_priority_support",
  "feature_success_manager",
  "feature_sla_credit",
]

describe("FEATURES", () => {
  it("usa exatamente as chaves da §5.3", () => {
    expect([...FEATURE_KEYS].sort()).toEqual([...RESEARCH_FEATURE_KEYS].sort())
    expect(Object.keys(FEATURES)).toEqual([...FEATURE_KEYS])
  })

  it("tem textos, grupo válido e ao menos um plano em cada recurso", () => {
    for (const key of FEATURE_KEYS) {
      const feature = FEATURES[key]
      expect(feature.label.trim(), key).not.toBe("")
      expect(feature.description.trim(), key).not.toBe("")
      expect(FEATURE_GROUPS, key).toContain(feature.group)
      expect(["available", "soon"], key).toContain(feature.status)
      expect(feature.plans.length, key).toBeGreaterThan(0)
      for (const plan of feature.plans) {
        expect(PLAN_KEYS, key).toContain(plan)
      }
    }
  })

  it("agrupa os recursos na ordem de FEATURE_GROUPS", () => {
    const groupOrder = FEATURE_KEYS.map((key) => FEATURE_GROUPS.indexOf(FEATURES[key].group))
    expect(groupOrder).toEqual([...groupOrder].sort((a, b) => a - b))
  })

  it("marca como disponível o que já existe no app", () => {
    const available: FeatureKey[] = [
      "feature_properties",
      "feature_condominiums",
      "feature_listing_score",
      "feature_capture_public_form",
      "feature_keys",
      "feature_clients",
      "feature_calendar_tasks",
      "feature_leads_kanban",
      "feature_proposals",
      "feature_property_client_match",
      "feature_landing_pages",
      "feature_portal_feed_vrsync",
      "feature_team_roles_invites",
      "feature_tenant_subdomain",
    ]
    for (const key of available) {
      expect(FEATURES[key].status, key).toBe("available")
    }
  })

  it("marca como em breve a Entrega 2, integrações e locação", () => {
    const soon: FeatureKey[] = [
      "feature_ai_whatsapp",
      "feature_whatsapp_official_inbox",
      "feature_lead_roulette_sla",
      "feature_portal_leads_ingest",
      "feature_meta_lead_ads",
      "feature_pwa_push",
      "feature_instagram_publish",
      "feature_maps",
      "feature_esignature",
      "feature_bi_goals",
      "feature_launches",
      "feature_api_read",
      "feature_rental_contracts",
      "feature_dimob",
      "feature_nfse",
      "feature_multiple_pipelines",
      "feature_custom_domain",
      "feature_multi_branch",
      "feature_data_export",
    ]
    for (const key of soon) {
      expect(FEATURES[key].status, key).toBe("soon")
    }
  })
})

describe("planHasFeature", () => {
  it("inclui os módulos básicos em todos os planos", () => {
    for (const plan of PLAN_KEYS) {
      expect(planHasFeature(plan, "feature_properties")).toBe(true)
      expect(planHasFeature(plan, "feature_landing_pages")).toBe(true)
      expect(planHasFeature(plan, "feature_portal_feed_vrsync")).toBe(true)
    }
  })

  it("respeita a inclusão por plano da §3.3", () => {
    expect(planHasFeature("corretor", "feature_lead_roulette_sla")).toBe(false)
    expect(planHasFeature("imobiliaria", "feature_lead_roulette_sla")).toBe(true)
    expect(planHasFeature("corretor", "feature_rental_contracts")).toBe(false)
    expect(planHasFeature("imobiliaria", "feature_rental_contracts")).toBe(true)
    expect(planHasFeature("imobiliaria", "feature_bi_goals")).toBe(false)
    expect(planHasFeature("equipe", "feature_bi_goals")).toBe(true)
    expect(planHasFeature("equipe", "feature_api_read")).toBe(true)
    expect(planHasFeature("equipe", "feature_api_full")).toBe(false)
    expect(planHasFeature("equipe", "feature_launches")).toBe(false)
    expect(planHasFeature("rede", "feature_launches")).toBe(true)
    expect(planHasFeature("equipe", "feature_multi_branch")).toBe(false)
    expect(planHasFeature("rede", "feature_multi_branch")).toBe(true)
  })

  it("dá ao teste grátis os recursos do Equipe", () => {
    for (const key of FEATURE_KEYS) {
      expect(planHasFeature("trial", key), key).toBe(planHasFeature("equipe", key))
    }
    expect(featuresForPlan("trial")).toEqual(featuresForPlan("equipe"))
  })

  it("é cumulativo: cada plano tem tudo do plano anterior", () => {
    for (let index = 1; index < PLAN_KEYS.length; index++) {
      const lower = featuresForPlan(PLAN_KEYS[index - 1] as BillingPlanKey)
      const higher = featuresForPlan(PLAN_KEYS[index] as BillingPlanKey)
      expect(higher).toEqual(expect.arrayContaining(lower))
      expect(higher.length).toBeGreaterThan(lower.length)
    }
  })

  it("devolve false para plano ou recurso desconhecido", () => {
    expect(planHasFeature("ouro" as BillingPlanKey, "feature_properties")).toBe(false)
    expect(planHasFeature("rede", "feature_teleporte" as FeatureKey)).toBe(false)
    expect(planHasFeature("rede", "toString" as FeatureKey)).toBe(false)
  })
})

describe("isFeatureKey", () => {
  it("aceita só chaves do catálogo", () => {
    expect(isFeatureKey("feature_maps")).toBe(true)
    expect(isFeatureKey("feature_inexistente")).toBe(false)
    expect(isFeatureKey("constructor")).toBe(false)
    expect(isFeatureKey(42)).toBe(false)
  })
})
