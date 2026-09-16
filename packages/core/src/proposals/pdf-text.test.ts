import { describe, expect, it } from "vitest"

import { isWinAnsiEncodable, toWinAnsi, wrapText, type MeasureText } from "./pdf-text"

/** Medição de mentira: 1 caractere = 1 unidade (como uma fonte monoespaçada). */
const measure: MeasureText = (text) => text.length

describe("toWinAnsi", () => {
  it("mantém o pt-BR inteiro", () => {
    const text = "Proposta de aquisição — R$ 1.250.000,00 (Cond. Jardim São João, 3º andar)"
    expect(toWinAnsi(text)).toBe(text)
  })

  it("mantém acentos, cedilha e til", () => {
    expect(toWinAnsi("áéíóúàâêôãõçÁÉÍÓÚÃÕÇ")).toBe("áéíóúàâêôãõçÁÉÍÓÚÃÕÇ")
  })

  it("junta acento combinado no caractere único que a WinAnsi codifica", () => {
    const decomposed = "França" // "França" com cedilha combinante
    expect(isWinAnsiEncodable("̧")).toBe(false)
    expect(toWinAnsi(decomposed)).toBe("França")
  })

  it("troca o que a WinAnsi não codifica e descarta o resto", () => {
    expect(toWinAnsi("entrada ≥ 30%")).toBe("entrada >= 30%")
    expect(toWinAnsi("sinal → escritura")).toBe("sinal -> escritura")
    expect(toWinAnsi("tudo certo ✅")).toBe("tudo certo ")
  })

  it("padroniza quebras de linha e trata vazio", () => {
    expect(toWinAnsi("uma\r\nduas\rtrês")).toBe("uma\nduas\ntrês")
    expect(toWinAnsi(null)).toBe("")
    expect(toWinAnsi(undefined)).toBe("")
    expect(toWinAnsi("")).toBe("")
  })
})

describe("wrapText", () => {
  it("quebra por palavras dentro da largura", () => {
    expect(wrapText("uma duas tres quatro", 9, measure)).toEqual(["uma duas", "tres", "quatro"])
  })

  it("respeita as quebras digitadas, inclusive linha em branco", () => {
    expect(wrapText("primeira\n\nsegunda", 20, measure)).toEqual(["primeira", "", "segunda"])
  })

  it("parte palavra maior que a linha", () => {
    expect(wrapText("abcdefghij", 4, measure)).toEqual(["abcd", "efgh", "ij"])
  })

  it("parte a palavra longa depois de fechar a linha anterior", () => {
    expect(wrapText("ok abcdefghij", 4, measure)).toEqual(["ok", "abcd", "efgh", "ij"])
  })

  it("devolve vazio para largura inútil", () => {
    expect(wrapText("qualquer coisa", 0, measure)).toEqual([])
  })
})
