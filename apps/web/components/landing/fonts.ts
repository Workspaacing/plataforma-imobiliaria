import { Archivo, Bodoni_Moda } from "next/font/google"

/**
 * Tipografia fixa dos modelos (a marca do cliente entra pela cor e pelo logo).
 * - Archivo com eixo de largura: preços, condições e números em corpo
 *   condensado (campanhas e vitrines).
 * - Bodoni Moda: nome do empreendimento nos lançamentos, na tradição dos
 *   books de incorporadora. Só em corpos grandes.
 * O texto corrido usa a Geist do layout raiz.
 */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-lp-display",
  display: "swap",
})

const serif = Bodoni_Moda({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-lp-serif",
  display: "swap",
  preload: false,
})

export const landingFontVariables = `${display.variable} ${serif.variable}`
