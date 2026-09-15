import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { TRIAL_DAYS } from "@workspace/core/billing"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"

import { AddonsList } from "@/components/billing/addons-list"
import { loadCatalogPrices } from "@/components/billing/billing-data"
import { PlanComparison } from "@/components/billing/plan-comparison"
import { PlanConditions } from "@/components/billing/plan-conditions"
import { PlanRecommender } from "@/components/billing/plan-recommender"
import { PlansFaq } from "@/components/billing/plans-faq"
import { PricingPlans } from "@/components/billing/pricing-plans"
import { APP_NAME, BrandLogo } from "@/components/crm/brand"
import { LOGIN_PATH, SIGN_UP_PATH } from "@/lib/auth/routes"

// Estática com ISR: sem cookies nem headers; os preços do catálogo valem por 1 hora.
export const revalidate = 3600

const DESCRIPTION = `Planos do ${APP_NAME} para corretores e imobiliárias: funil de leads, landing pages e feed para os portais. Teste grátis por ${TRIAL_DAYS} dias, sem cartão e sem fidelidade.`

export const metadata: Metadata = {
  title: `Planos e preços · ${APP_NAME}`,
  description: DESCRIPTION,
  openGraph: {
    title: `Planos e preços · ${APP_NAME}`,
    description: DESCRIPTION,
    type: "website",
    locale: "pt_BR",
  },
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  const headingId = `${id}-titulo`

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="mx-auto flex w-full max-w-6xl scroll-mt-4 flex-col gap-8 px-4 py-12 lg:px-6 lg:py-16"
    >
      <div className="flex flex-col gap-2 text-center">
        <h2
          id={headingId}
          className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
        >
          {title}
        </h2>
        {description ? (
          <p className="mx-auto max-w-2xl text-balance text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export default async function PlanosPage() {
  const prices = await loadCatalogPrices()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <a
        href="#conteudo"
        className="sr-only rounded-lg bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:ring-3 focus:ring-ring/50"
      >
        Pular para o conteúdo
      </a>

      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <Link href="/" aria-label={`${APP_NAME}: página inicial`} className="rounded-md">
            <BrandLogo />
          </Link>
          <nav aria-label="Acesso" className="flex items-center gap-2">
            <Button variant="ghost" render={<Link href={LOGIN_PATH} />} nativeButton={false}>
              Entrar
            </Button>
            <Button render={<Link href={SIGN_UP_PATH} />} nativeButton={false}>
              <span className="sm:hidden">Testar grátis</span>
              <span className="hidden sm:inline">Começar teste grátis</span>
            </Button>
          </nav>
        </div>
      </header>

      <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <section aria-labelledby="hero-titulo" className="border-b">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center lg:py-24">
            <Badge variant="secondary">{TRIAL_DAYS} dias grátis, sem cartão</Badge>
            <h1
              id="hero-titulo"
              className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
            >
              Nenhum lead sem resposta.
            </h1>
            <p className="max-w-2xl text-lg text-balance text-muted-foreground">
              Leads dos portais, das landing pages e do WhatsApp num funil só, com a equipe
              atendendo rápido. Teste todos os recursos por {TRIAL_DAYS} dias, sem cartão.
            </p>
            <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <Button size="lg" render={<Link href={SIGN_UP_PATH} />} nativeButton={false}>
                Começar teste grátis
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<a href="#planos" />}
                nativeButton={false}
              >
                Ver os planos
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Sem fidelidade · sem taxa de implantação · migração grátis
            </p>
          </div>
        </section>

        <Section
          id="planos"
          title="Um plano para cada tamanho de operação"
          description="Imóveis, condomínios e clientes ilimitados em todos os planos. Valores em reais."
        >
          <PricingPlans prices={prices} />
        </Section>

        <Separator />

        <Section
          id="recomendador"
          title="Qual plano combina com você?"
          description="Responda três perguntas e veja o plano indicado, o total por mês e quanto economiza no anual."
        >
          <PlanRecommender prices={prices} />
        </Section>

        <Separator />

        <Section
          id="comparativo"
          title="Compare os planos"
          description="Recursos marcados como “Em breve” ainda estão em construção e chegam sem custo extra para quem já tem o plano."
        >
          <PlanComparison prices={prices} />
        </Section>

        <Separator />

        <Section
          id="add-ons"
          title="Add-ons"
          description="Extras para quando a operação crescer. Chegam em breve, com estes preços."
        >
          <AddonsList />
        </Section>

        <Separator />

        <Section id="condicoes" title="Condições em linguagem simples">
          <PlanConditions />
        </Section>

        <Separator />

        <Section id="perguntas" title="Perguntas frequentes">
          <div className="mx-auto w-full max-w-3xl">
            <PlansFaq />
          </div>
        </Section>

        <section aria-labelledby="cta-titulo" className="border-t">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
            <h2 id="cta-titulo" className="text-2xl font-semibold tracking-tight text-balance">
              Comece hoje e responda o próximo lead a tempo.
            </h2>
            <p className="text-balance text-muted-foreground">
              {TRIAL_DAYS} dias grátis, sem cartão. Se não for para você, é só não assinar.
            </p>
            <Button size="lg" render={<Link href={SIGN_UP_PATH} />} nativeButton={false}>
              Começar teste grátis
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row lg:px-6">
          <p>© {APP_NAME}. Preços em reais (BRL).</p>
          <nav aria-label="Rodapé" className="flex items-center gap-4">
            <Link href={LOGIN_PATH} className="underline-offset-4 hover:underline">
              Entrar
            </Link>
            <Link href={SIGN_UP_PATH} className="underline-offset-4 hover:underline">
              Criar conta
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
