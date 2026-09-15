import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const fontTypeset = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      dir="ltr"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable,
        fontTypeset.variable
      )}
    >
      {/* Extensões como ColorZilla injetam atributos no body antes da hidratação. */}
      <body suppressHydrationWarning>
        <DirectionProvider direction="ltr">
          <ThemeProvider>{children}</ThemeProvider>
        </DirectionProvider>
      </body>
    </html>
  )
}
