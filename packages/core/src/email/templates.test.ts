import { describe, expect, it } from "vitest"

import { DEFAULT_BRAND_COLOR } from "./sanitize"
import {
  captureRequestEmail,
  EmailTemplateError,
  newLeadEmail,
  subscriptionNoticeEmail,
  teamInvitationEmail,
} from "./templates"

const ORIGIN = "https://imob-teste.seucrm.com.br"
const LEAD_ID = "3f0c1a2b-4d5e-4f60-8a7b-9c0d1e2f3a4b"
const LINE_SEPARATOR = String.fromCharCode(0x2028)
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029)

function lead(overrides: Partial<Parameters<typeof newLeadEmail>[0]["lead"]> = {}) {
  return newLeadEmail({
    origin: ORIGIN,
    brand: { name: "Imobiliária Teste", primaryColor: "#123456" },
    recipientName: "Carla Souza",
    lead: {
      id: LEAD_ID,
      name: "Maria Silva",
      source: "landing_page",
      landingPageName: "Lançamento Jardins",
      phone: "11987654321",
      interest: "buy",
      receivedAt: "2026-09-15T17:30:00Z",
      ...overrides,
    },
  })
}

describe("escape de dados do usuário", () => {
  it("escapa <script> no HTML e não deixa tags no texto puro", () => {
    const email = lead({ name: '<script>alert("x")</script>' })

    expect(email.html).not.toContain("<script>")
    expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;")
    expect(email.subject).not.toMatch(/[\r\n]/)
    // Texto puro não é interpretado: o nome aparece literal, sem marcação do layout.
    expect(email.text).toContain('<script>alert("x")</script>')
    expect(email.text).not.toMatch(/<(p|table|td|a|br|h1)\b/i)
  })

  it("escapa aspas simples, duplas e crase em conteúdo e atributos", () => {
    const email = lead({ name: `O'Brien "Zé" \`x\``, landingPageName: `" onmouseover="alert(1)` })

    expect(email.html).toContain("O&#39;Brien &quot;Zé&quot; &#96;x&#96;")
    expect(email.html).not.toContain('" onmouseover="')
    expect(email.html).toContain("&quot; onmouseover=&quot;alert(1)")
  })

  it("remove U+2028/U+2029 e caracteres de controle do assunto, HTML e texto", () => {
    const email = lead({
      name: `Ana${LINE_SEPARATOR}Maria${PARAGRAPH_SEPARATOR}\u0000\u202eSouza`,
    })

    for (const part of [email.subject, email.html, email.text]) {
      expect(part).not.toContain(LINE_SEPARATOR)
      expect(part).not.toContain(PARAGRAPH_SEPARATOR)
      expect(part).not.toContain("\u0000")
      expect(part).not.toContain("\u202e")
    }

    expect(email.subject).toContain("Ana Maria Souza")
  })

  it("não aceita cor da marca fora do formato hexadecimal", () => {
    const email = newLeadEmail({
      origin: ORIGIN,
      brand: { name: "Imob", primaryColor: "red;background:url(https://evil.example/x)" },
      lead: { name: "Maria" },
    })

    expect(email.html).not.toContain("evil.example")
    expect(email.html).toContain(DEFAULT_BRAND_COLOR)
  })
})

describe("links", () => {
  it("rejeita javascript: e outros esquemas no link do convite", () => {
    const base = {
      origin: ORIGIN,
      organizationName: "Imobiliária Teste",
      role: "broker",
      expiresAt: "2026-09-22T12:00:00Z",
    }

    for (const invitationUrl of [
      "javascript:alert(1)",
      " JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "//evil.example/convite",
      "http://evil.example/convite",
    ]) {
      expect(() => teamInvitationEmail({ ...base, invitationUrl })).toThrow(EmailTemplateError)
    }
  })

  it("recusa origem que não seja https (ou http em localhost)", () => {
    expect(() => newLeadEmail({ origin: "javascript:alert(1)", lead: { name: "Maria" } })).toThrow(
      EmailTemplateError
    )
    expect(() => newLeadEmail({ origin: "http://imob.example", lead: { name: "Maria" } })).toThrow(
      EmailTemplateError
    )
    expect(
      newLeadEmail({ origin: "http://imob.localhost:3000", lead: { name: "Maria" } }).text
    ).toContain("http://imob.localhost:3000/leads")
  })

  it("aponta para /leads/{id} e cai no funil sem id válido", () => {
    expect(lead().html).toContain(`${ORIGIN}/leads/${LEAD_ID}`)
    expect(lead().text).toContain(`${ORIGIN}/leads/${LEAD_ID}`)
    expect(lead({ id: "../../admin" }).text).toContain(`${ORIGIN}/leads\n`)
  })
})

describe("novo lead", () => {
  it("assunto curto e estável", () => {
    expect(lead().subject).toMatchInlineSnapshot(`"Novo lead: Maria Silva — responda agora"`)
  })

  it("mostra origem, landing page, interesse e telefone mascarado; enfatiza responder rápido", () => {
    const { html, text } = lead()

    expect(text).toContain("Origem: Landing page")
    expect(text).toContain("Landing page: Lançamento Jardins")
    expect(text).toContain("Interesse: Comprar")
    expect(text).toContain("Telefone: (11) *****-4321")
    expect(text).not.toContain("987654321")
    expect(html).not.toContain("987654321")
    expect(text).toContain("Responda nos próximos minutos")
    expect(text).toContain("Olá, Carla!")
    expect(text).toContain("Você recebeu este e-mail porque é responsável por este lead")
  })

  it("HTML de e-mail: idioma, modo escuro, tabelas e sem imagens", () => {
    const { html } = lead()

    expect(html).toContain('<html lang="pt-BR"')
    expect(html).toContain('<meta name="color-scheme" content="light dark">')
    expect(html).toContain("prefers-color-scheme: dark")
    expect(html).toContain('role="presentation"')
    expect(html).not.toMatch(/<img\b/i)
    expect(html).toContain("#123456")
  })
})

describe("nova solicitação de captação", () => {
  it("assunto com tipo e local, link para /captacao e sem dados do proprietário", () => {
    const email = captureRequestEmail({
      origin: ORIGIN,
      brand: { name: "Imobiliária Teste" },
      request: {
        propertyType: "apartment",
        purpose: "sale",
        neighborhood: "Centro",
        city: "Campinas",
        state: "sp",
      },
    })

    expect(email.subject).toMatchInlineSnapshot(
      `"Nova solicitação de captação: Apartamento em Centro, Campinas/SP"`
    )
    expect(email.text).toContain(`${ORIGIN}/captacao`)
    expect(email.text).toContain("Finalidade: Venda")
    expect(email.text).toContain("dono, gerente ou captador")
  })

  it("tipo desconhecido não vira texto livre", () => {
    const email = captureRequestEmail({
      origin: ORIGIN,
      request: { propertyType: "<b>castelo</b>" },
    })

    expect(email.subject).toBe("Nova solicitação de captação: imóvel")
    expect(email.html).not.toContain("castelo")
  })
})

describe("convite para a equipe", () => {
  it("mostra quem convidou, imobiliária, papel e validade", () => {
    const email = teamInvitationEmail({
      origin: ORIGIN,
      organizationName: "Imobiliária Teste",
      inviterName: "João Pereira",
      role: "broker",
      invitationUrl: `${ORIGIN}/convite/abc123`,
      expiresAt: "2026-09-22T15:00:00Z",
    })

    expect(email.subject).toMatchInlineSnapshot(
      `"João Pereira convidou você para o CRM de Imobiliária Teste"`
    )
    expect(email.text).toContain("Papel: Corretor")
    expect(email.text).toContain("Válido até: 22 de setembro de 2026")
    expect(email.text).toContain(`Aceitar convite: ${ORIGIN}/convite/abc123`)
  })
})

describe("aviso de assinatura", () => {
  const base = {
    origin: ORIGIN,
    organizationName: "Imobiliária Teste",
    date: "2026-09-30T12:00:00Z",
  }

  it("quatro tipos, sempre com link para /configuracoes/assinatura", () => {
    const trial = subscriptionNoticeEmail({ ...base, kind: "trial_ending" })
    const failed = subscriptionNoticeEmail({ ...base, kind: "payment_failed" })
    const canceled = subscriptionNoticeEmail({ ...base, kind: "canceled" })
    const readOnly = subscriptionNoticeEmail({ ...base, kind: "read_only" })

    expect(trial.subject).toMatchInlineSnapshot(
      `"O teste gratuito de Imobiliária Teste termina em 30 de setembro de 2026"`
    )
    expect(failed.subject).toMatchInlineSnapshot(
      `"Não conseguimos cobrar a assinatura de Imobiliária Teste"`
    )
    expect(canceled.subject).toMatchInlineSnapshot(
      `"A assinatura de Imobiliária Teste foi cancelada"`
    )
    expect(readOnly.subject).toMatchInlineSnapshot(`"Sua conta está em modo somente leitura"`)

    for (const email of [trial, failed, canceled, readOnly]) {
      expect(email.text).toContain(`${ORIGIN}/configuracoes/assinatura`)
      expect(email.text).toContain("responsável pela assinatura")
    }
  })

  it("somente leitura: explica o que continua e o que fica bloqueado, com a data", () => {
    const { html, text } = subscriptionNoticeEmail({ ...base, kind: "read_only" })

    expect(text).toContain("somente leitura desde 30 de setembro de 2026")
    expect(text).toContain("ver e exportar tudo")
    expect(text).toContain("landing pages e os formulários continuam recebendo leads")
    expect(text).toContain("Não é possível criar nem editar registros até regularizar")
    expect(text).toContain("Nenhum dado foi apagado.")
    expect(text).toContain(`Regularizar assinatura: ${ORIGIN}/configuracoes/assinatura`)
    expect(html).toContain(`href="${ORIGIN}/configuracoes/assinatura"`)
    expect(subscriptionNoticeEmail({ ...base, date: null, kind: "read_only" }).text).toContain(
      "está em modo somente leitura."
    )
  })

  it("tipo inválido lança erro", () => {
    expect(() =>
      subscriptionNoticeEmail({ ...base, kind: "refund" as unknown as "canceled" })
    ).toThrow(EmailTemplateError)
  })
})
