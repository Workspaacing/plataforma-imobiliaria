"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

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
      <ThemeHotkey disabled={forcedTheme !== undefined} />
      {children}
    </NextThemesProvider>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey({ disabled }: { disabled: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    // Com tema forçado, o atalho mudaria a preferência do CRM sem efeito visível.
    if (disabled) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [disabled, resolvedTheme, setTheme])

  return null
}

export { ThemeProvider }
