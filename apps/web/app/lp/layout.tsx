/**
 * Landing pages públicas (/lp/[org]/[page]): sem a casca do CRM, sem sidebar e
 * sem exigir login. `lang="pt-BR"` vem do layout raiz.
 */
export default function LandingPagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <div className="min-h-svh bg-background text-foreground">{children}</div>
}
