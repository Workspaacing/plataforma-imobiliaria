// Estrutura visual comum dos e-mails: HTML em tabelas (compatível com Outlook e
// Gmail), sem imagens, legível em modo escuro, e a mesma mensagem em texto puro.
// Todo texto recebido aqui é tratado como dado não confiável: limpo e escapado.

import {
  cleanText,
  DEFAULT_BRAND_COLOR,
  escapeHtml,
  normalizeHexColor,
  readableTextColor,
} from "./sanitize"

export const DEFAULT_BRAND_NAME = "CRM Imobiliário"

export type EmailBrand = {
  /** Nome da imobiliária; sem ele, "CRM Imobiliário". */
  name?: string | null
  /** Cor da marca em hexadecimal; outra coisa usa a cor padrão. */
  primaryColor?: string | null
}

export type ResolvedBrand = {
  name: string
  color: string
  textOnColor: string
  isDefaultName: boolean
}

export type EmailDetail = { label: string; value: string | null | undefined }

export type EmailAction = {
  label: string
  /** URL já validada por resolveEmailLink (https, ou http só em localhost). */
  url: string
}

export type EmailContent = {
  subject: string
  /** Resumo que os clientes de e-mail mostram ao lado do assunto. */
  preheader: string
  heading: string
  greeting?: string | null
  paragraphs: readonly string[]
  /** Aviso em destaque (ex.: responder rápido). */
  highlight?: string | null
  details?: readonly EmailDetail[]
  action?: EmailAction | null
  closing?: readonly string[]
  /** Por que a pessoa recebeu este e-mail. */
  footer: string
}

export type RenderedEmail = { subject: string; html: string; text: string }

const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function resolveBrand(brand: EmailBrand | null | undefined): ResolvedBrand {
  const name = cleanText(brand?.name, { maxLength: 80 })
  const color = normalizeHexColor(brand?.primaryColor) ?? DEFAULT_BRAND_COLOR

  return {
    name: name || DEFAULT_BRAND_NAME,
    color,
    textOnColor: readableTextColor(color),
    isDefaultName: !name,
  }
}

function html(value: string, multiline = false) {
  const escaped = escapeHtml(cleanText(value, { multiline }))
  return multiline ? escaped.replace(/\n/g, "<br>") : escaped
}

function isSafeActionUrl(url: string) {
  return /^https?:\/\/[^\s"'<>\\]+$/i.test(url)
}

const STYLE = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin: 0; padding: 0; width: 100% !important; }
  table { border-collapse: collapse; }
  @media (prefers-color-scheme: dark) {
    .em-bg { background-color: #0f1115 !important; }
    .em-card { background-color: #181b21 !important; border-color: #2c313a !important; }
    .em-text { color: #e8eaed !important; }
    .em-muted { color: #a8aeb8 !important; }
    .em-callout { background-color: #222833 !important; }
    .em-row { border-color: #2c313a !important; }
    .em-link { color: #c9d1dc !important; }
  }
  [data-ogsc] .em-bg { background-color: #0f1115 !important; }
  [data-ogsc] .em-card { background-color: #181b21 !important; border-color: #2c313a !important; }
  [data-ogsc] .em-text { color: #e8eaed !important; }
  [data-ogsc] .em-muted { color: #a8aeb8 !important; }
  [data-ogsc] .em-callout { background-color: #222833 !important; }
  [data-ogsc] .em-link { color: #c9d1dc !important; }
  @media only screen and (max-width: 620px) {
    .em-container { width: 100% !important; }
    .em-pad { padding: 24px 20px !important; }
  }
`

function renderDetails(details: readonly EmailDetail[]) {
  const rows = details
    .map((detail) => ({
      label: cleanText(detail.label, { maxLength: 60 }),
      value: cleanText(detail.value, { maxLength: 300 }),
    }))
    .filter((detail) => detail.label && detail.value)

  if (rows.length === 0) {
    return { html: "", text: "" }
  }

  const htmlRows = rows
    .map(
      (row) =>
        `<tr><th scope="row" align="left" valign="top" class="em-muted em-row" style="padding:10px 12px 10px 0;width:38%;font-family:${FONT_STACK};font-size:14px;line-height:1.4;font-weight:600;color:#4b5563;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.label)}</th>` +
        `<td valign="top" class="em-text em-row" style="padding:10px 0;font-family:${FONT_STACK};font-size:14px;line-height:1.4;color:#111827;border-bottom:1px solid #e5e7eb;word-break:break-word;">${escapeHtml(row.value)}</td></tr>`
    )
    .join("")

  return {
    html: `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;border-collapse:collapse;">${htmlRows}</table>`,
    text: rows.map((row) => `${row.label}: ${row.value}`).join("\n"),
  }
}

/** Monta assunto, HTML e texto puro a partir do conteúdo (dados não confiáveis). */
export function renderEmail(
  brandInput: EmailBrand | null | undefined,
  content: EmailContent
): RenderedEmail {
  const brand = resolveBrand(brandInput)
  const heading = cleanText(content.heading, { maxLength: 150 })
  const subject = cleanText(content.subject, { maxLength: 150 }) || heading || brand.name
  const preheader = cleanText(content.preheader, { maxLength: 140 })
  const greeting = cleanText(content.greeting, { maxLength: 80 })
  const paragraphs = content.paragraphs
    .map((paragraph) => cleanText(paragraph, { multiline: true, maxLength: 1200 }))
    .filter(Boolean)
  const highlight = cleanText(content.highlight, { multiline: true, maxLength: 400 })
  const closing = (content.closing ?? [])
    .map((paragraph) => cleanText(paragraph, { multiline: true, maxLength: 800 }))
    .filter(Boolean)
  const footer = cleanText(content.footer, { multiline: true, maxLength: 600 })
  const details = renderDetails(content.details ?? [])
  const actionLabel = cleanText(content.action?.label, { maxLength: 60 })
  const action =
    content.action && actionLabel && isSafeActionUrl(content.action.url)
      ? { label: actionLabel, url: content.action.url }
      : null
  const signature = brand.isDefaultName
    ? `Mensagem automática do ${DEFAULT_BRAND_NAME}.`
    : `Mensagem automática do ${DEFAULT_BRAND_NAME} para ${brand.name}.`

  const paragraphStyle = `margin:0 0 16px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#1f2937;`
  const paragraphHtml = (value: string) =>
    `<p class="em-text" style="${paragraphStyle}">${html(value, true)}</p>`

  const highlightHtml = highlight
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;"><tr><td class="em-callout" style="padding:14px 16px;background-color:#f3f4f6;border-left:4px solid ${brand.color};border-radius:6px;"><p class="em-text" style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:1.5;font-weight:600;color:#111827;">${html(highlight, true)}</p></td></tr></table>`
    : ""

  const actionHtml = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;"><tr><td align="center" bgcolor="${brand.color}" style="border-radius:8px;background-color:${brand.color};">` +
      `<a href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 24px;font-family:${FONT_STACK};font-size:16px;line-height:1.2;font-weight:600;color:${brand.textOnColor};text-decoration:none;border-radius:8px;">${escapeHtml(action.label)}</a>` +
      `</td></tr></table>` +
      `<p class="em-muted" style="margin:0 0 24px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:#6b7280;">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer" class="em-link" style="color:#374151;text-decoration:underline;word-break:break-all;">${escapeHtml(action.url)}</a></p>`
    : ""

  const bodyHtml = [
    `<h1 class="em-text" style="margin:0 0 16px;font-family:${FONT_STACK};font-size:22px;line-height:1.3;font-weight:700;color:#111827;">${html(heading)}</h1>`,
    greeting ? paragraphHtml(greeting) : "",
    ...paragraphs.map(paragraphHtml),
    highlightHtml,
    details.html,
    actionHtml,
    ...closing.map(
      (paragraph) =>
        `<p class="em-muted" style="margin:0 0 12px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:#4b5563;">${html(paragraph, true)}</p>`
    ),
  ].join("")

  const document = `<!doctype html>
<html lang="pt-BR" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<style>${STYLE}</style>
</head>
<body class="em-bg" style="margin:0;padding:0;background-color:#f4f5f7;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-bg" style="width:100%;background-color:#f4f5f7;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="em-container" style="width:600px;max-width:600px;">
<tr><td style="padding:0 8px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="12" height="12" bgcolor="${brand.color}" style="width:12px;height:12px;background-color:${brand.color};border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>
<td class="em-text" style="padding-left:10px;font-family:${FONT_STACK};font-size:15px;line-height:1.2;font-weight:700;color:#111827;">${escapeHtml(brand.name)}</td>
</tr></table>
</td></tr>
<tr><td class="em-card" style="background-color:#ffffff;border:1px solid #e3e6ea;border-top:4px solid ${brand.color};border-radius:12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="em-pad" style="padding:32px;">${bodyHtml}</td></tr></table>
</td></tr>
<tr><td class="em-muted" style="padding:20px 8px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:#6b7280;">
<p style="margin:0 0 8px;">${html(footer, true)}</p>
<p style="margin:0;">${escapeHtml(signature)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    heading,
    greeting,
    ...paragraphs,
    highlight,
    details.text,
    action ? `${action.label}: ${action.url}` : "",
    ...closing,
    "--",
    footer,
    signature,
  ]
    .filter(Boolean)
    .join("\n\n")

  return { subject, html: document, text }
}
