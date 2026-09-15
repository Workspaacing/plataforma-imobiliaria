"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Páginas públicas (landing pages e formulário de captação) sempre em tema
 * claro, qualquer que seja a preferência salva para o CRM. Vale para a URL
 * curta do subdomínio (/lp/{pagina}, /captar) e para a rota interna ou longa
 * (/lp/{org}/{pagina}, /captar/{slug}).
 */
function isLightOnlyPath(pathname: string | null) {
  if (!pathname) {
    return false
  }

  return ["/lp", "/captar"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  // usePathname funciona na renderização do servidor sem ler headers/cookies,
  // então as landing pages continuam estáticas (ISR). Com forcedTheme, o script
  // anti-flash já aplica "light" antes da pintura e a preferência do usuário
  // (localStorage) não é alterada.
  const forcedTheme = isLightOnlyPath(usePathname()) ? "light" : undefined

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={forcedTheme}
      // O script anti-flash roda no HTML do servidor; no cliente vira bloco de dados,
      // que o React 19.2 não acusa ao recriar a árvore (next-themes 0.4.6 não corrige).
      scriptProps={{
        type: typeof window === "undefined" ? undefined : "application/json",
      }}
      {...props}
    >
      {/* Sem atalho de tecla única para o tema (WCAG 2.1.4): a troca fica no botão do cabeçalho. */}
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
