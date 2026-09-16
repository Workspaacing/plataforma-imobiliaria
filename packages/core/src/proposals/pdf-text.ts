// Preparo do texto do PDF da proposta. Módulo puro: sem fontes, sem I/O — quem
// desenha injeta a medição do texto.
//
// As 14 fontes padrão do PDF (Helvetica e companhia) usam a codificação
// WinAnsi (Windows-1252): cobre todo o pt-BR (á, ç, ã, õ, "R$", "º") e lança
// erro em qualquer caractere fora dela (emoji, "≥", setas). Como o texto vem
// do que a equipe digitou, tudo passa por `toWinAnsi` antes de virar PDF.

/** Faixas e caracteres avulsos da codificação WinAnsi (Windows-1252). */
const WINANSI_EXTRAS = [
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e, 0x0192, 0x02c6, 0x02dc, 0x2013, 0x2014,
  0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039,
  0x203a, 0x20ac, 0x2122,
]

const WINANSI_CODE_POINTS = new Set<number>(WINANSI_EXTRAS)

for (let code = 0x20; code <= 0x7e; code += 1) {
  WINANSI_CODE_POINTS.add(code)
}

for (let code = 0xa0; code <= 0xff; code += 1) {
  WINANSI_CODE_POINTS.add(code)
}

/** Trocas legíveis para o que aparece de vez em quando em condições e observações. */
const FALLBACKS: Record<string, string> = {
  "\t": " ",
  " ": " ",
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~",
  "×": "x",
  "⁄": "/",
  "✓": "-",
  "✔": "-",
  "●": "-",
  "▪": "-",
  " ": "\n",
  " ": "\n",
}

export function isWinAnsiEncodable(character: string): boolean {
  const code = character.codePointAt(0)
  return code !== undefined && WINANSI_CODE_POINTS.has(code)
}

/**
 * Texto pronto para as fontes padrão do PDF: normaliza acentos compostos
 * (NFC), padroniza as quebras de linha e troca o que a WinAnsi não codifica.
 * Caractere sem equivalente é descartado — nunca derruba a geração do PDF.
 */
export function toWinAnsi(value: string | null | undefined): string {
  if (!value) {
    return ""
  }

  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n")
  let result = ""

  for (const character of normalized) {
    if (character === "\n" || isWinAnsiEncodable(character)) {
      result += character
      continue
    }

    const fallback = FALLBACKS[character]

    if (fallback) {
      result += fallback
    }
  }

  return result
}

/** Largura do texto no tamanho escolhido (pdf-lib: font.widthOfTextAtSize). */
export type MeasureText = (text: string) => number

function breakLongWord(word: string, maxWidth: number, measure: MeasureText): string[] {
  const parts: string[] = []
  let current = ""

  for (const character of word) {
    const candidate = current + character

    if (current && measure(candidate) > maxWidth) {
      parts.push(current)
      current = character
      continue
    }

    current = candidate
  }

  if (current) {
    parts.push(current)
  }

  return parts
}

/**
 * Quebra o texto em linhas que cabem em `maxWidth`, respeitando as quebras que
 * a pessoa digitou. Palavra maior que a linha (URL, código) é partida.
 */
export function wrapText(text: string, maxWidth: number, measure: MeasureText): string[] {
  if (maxWidth <= 0) {
    return []
  }

  const lines: string[] = []

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean)

    if (words.length === 0) {
      lines.push("")
      continue
    }

    let current = ""

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word

      if (measure(candidate) <= maxWidth) {
        current = candidate
        continue
      }

      if (current) {
        lines.push(current)
      }

      if (measure(word) <= maxWidth) {
        current = word
        continue
      }

      const parts = breakLongWord(word, maxWidth, measure)
      lines.push(...parts.slice(0, -1))
      current = parts.at(-1) ?? ""
    }

    if (current) {
      lines.push(current)
    }
  }

  return lines
}
