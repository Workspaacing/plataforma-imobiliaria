import { describe, expect, it } from "vitest"

import { getTenantSlugIssue, isValidTenantSlug, RESERVED_SUBDOMAINS } from "./slug"

describe("isValidTenantSlug", () => {
  it("aceita rótulos DNS simples", () => {
    expect(isValidTenantSlug("teste")).toBe(true)
    expect(isValidTenantSlug("horizonte-imoveis")).toBe(true)
    expect(isValidTenantSlug("imob-2026")).toBe(true)
    expect(isValidTenantSlug("abc")).toBe(true)
    expect(isValidTenantSlug("a".repeat(60))).toBe(true)
  })

  it("recusa tamanho fora de 3 a 60", () => {
    expect(getTenantSlugIssue("ab")).toBe("length")
    expect(getTenantSlugIssue("a".repeat(61))).toBe("length")
    expect(getTenantSlugIssue("")).toBe("length")
  })

  it("recusa maiúsculas, acentos, ponto, sublinhado e espaço", () => {
    expect(getTenantSlugIssue("Teste")).toBe("characters")
    expect(getTenantSlugIssue("imóveis")).toBe("characters")
    expect(getTenantSlugIssue("a.b.c")).toBe("characters")
    expect(getTenantSlugIssue("te_ste")).toBe("characters")
    expect(getTenantSlugIssue("te ste")).toBe("characters")
  })

  it("recusa hífen nas pontas", () => {
    expect(getTenantSlugIssue("-teste")).toBe("hyphens")
    expect(getTenantSlugIssue("teste-")).toBe("hyphens")
  })

  it("recusa hífens seguidos em qualquer posição", () => {
    expect(getTenantSlugIssue("tes--te")).toBe("hyphens")
    expect(getTenantSlugIssue("ab--cd")).toBe("hyphens")
  })

  it("recusa rótulos IDN/punycode (xn--)", () => {
    expect(getTenantSlugIssue("xn--imveis-xxa")).toBe("hyphens")
    expect(isValidTenantSlug("xn--80ak6aa92e")).toBe(false)
  })

  it("recusa subdomínios reservados", () => {
    for (const reserved of ["www", "app", "api", "admin", "feeds", "captar", "convite"]) {
      expect(getTenantSlugIssue(reserved)).toBe("reserved")
    }
  })

  it("reserva status (página de status pública no domínio raiz)", () => {
    expect(RESERVED_SUBDOMAINS.has("status")).toBe(true)
    expect(getTenantSlugIssue("status")).toBe("reserved")
  })

  it("recusa reservados curtos pela regra de tamanho", () => {
    expect(isValidTenantSlug("lp")).toBe(false)
  })

  it("recusa valores que não são texto", () => {
    expect(isValidTenantSlug(null)).toBe(false)
    expect(isValidTenantSlug(undefined)).toBe(false)
    expect(isValidTenantSlug(123)).toBe(false)
  })
})

describe("RESERVED_SUBDOMAINS", () => {
  it("só tem entradas em minúsculas e sem espaços", () => {
    for (const value of RESERVED_SUBDOMAINS) {
      expect(value).toBe(value.trim().toLowerCase())
    }
  })

  it("tem a mesma quantidade da lista do banco (private.is_reserved_subdomain)", () => {
    expect(RESERVED_SUBDOMAINS.size).toBe(39)
  })
})
