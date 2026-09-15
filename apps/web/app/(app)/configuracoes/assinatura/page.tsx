import type { Metadata } from "next"
import { CircleAlertIcon, LockIcon, SettingsIcon } from "lucide-react"

import { BILLING_INTERVAL_LABELS } from "@workspace/core/billing"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { AddonsList } from "@/components/billing/addons-list"
import {
  loadBillingOverview,
  loadCatalogPrices,
  loadRecentInvoices,
} from "@/components/billing/billing-data"
import { BillingPortalButton } from "@/components/billing/billing-portal-button"
import { BillingStateBadge } from "@/components/billing/billing-state-badge"
import {
  CheckoutReturnNotice,
  type CheckoutReturnStatus,
} from "@/components/billing/checkout-return-notice"
import { InvoicesList } from "@/components/billing/invoices-list"
import {
  describeBillingState,
  isSubscriptionConfirmed,
  planDisplayName,
} from "@/components/billing/overview-view"
import { pluralize } from "@/components/billing/plan-content"
import { PlanSwitcher } from "@/components/billing/plan-switcher"
import { UsageMeters } from "@/components/billing/usage-meters"
import { PageHeading } from "@/components/crm/page-placeholder"
import { ORGANIZATION_VIEWER_ROLES } from "@/lib/auth/roles"
import { requireRole } from "@/lib/auth/session"
import { isStripeConfigured, type BillingOverview } from "@/lib/billing/queries"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = {
  title: "Assinatura",
}

type AssinaturaPageProps = {
  searchParams: Promise<{ checkout?: string | string[] }>
}

function readCheckoutStatus(value: string | string[] | undefined): CheckoutReturnStatus | null {
  return value === "sucesso" || value === "cancelado" ? value : null
}

function nextChargeLabel(overview: BillingOverview) {
  if (!overview.hasSubscription) {
    return "Nenhuma: você ainda não assinou"
  }

  if (overview.cancelAtPeriodEnd) {
    return "Nenhuma: assinatura cancelada"
  }

  return overview.currentPeriodEnd ? formatDate(overview.currentPeriodEnd) : "—"
}

/** O que segue funcionando e o que fica bloqueado no modo leitura (contrato, §1). */
function ReadOnlyDetails() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <p className="font-medium">Continua funcionando</p>
        <ul className="flex list-disc flex-col gap-1 ps-5 text-muted-foreground">
          <li>Ver e exportar imóveis, clientes e leads</li>
          <li>Landing pages captando leads</li>
          <li>Assinar ou regularizar o pagamento</li>
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">Fica pausado</p>
        <ul className="flex list-disc flex-col gap-1 ps-5 text-muted-foreground">
          <li>Criar e editar registros</li>
          <li>Convidar pessoas para a equipe</li>
          <li>Feed de imóveis para os portais</li>
        </ul>
      </div>
    </div>
  )
}

export default async function AssinaturaPage({ searchParams }: AssinaturaPageProps) {
  const { membership } = await requireRole(ORGANIZATION_VIEWER_ROLES)
  const isOwner = membership.role === "owner"
  const { checkout } = await searchParams
  const checkoutStatus = readCheckoutStatus(checkout)
  const stripeConfigured = isStripeConfigured()

  const [overview, prices, invoicesResult] = await Promise.all([
    loadBillingOverview(membership.organizationId),
    loadCatalogPrices(),
    loadRecentInvoices(membership.organizationId),
  ])

  const stateMessage = overview ? describeBillingState(overview) : null
  const portalAvailable = stripeConfigured && overview !== null && overview.planKey !== "trial"

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <PageHeading
        title="Assinatura"
        description="Plano, uso, pagamento e faturas da imobiliária."
      />

      <div className="flex w-full max-w-6xl flex-col gap-6">
        {checkoutStatus ? (
          <CheckoutReturnNotice
            status={checkoutStatus}
            confirmed={isSubscriptionConfirmed(overview)}
          />
        ) : null}

        {!stripeConfigured ? (
          <Alert>
            <SettingsIcon />
            <AlertTitle>Pagamentos em configuração</AlertTitle>
            <AlertDescription>
              A cobrança online ainda está sendo configurada. Você já pode ver o plano e o uso;
              assinar, trocar de plano e consultar faturas ficam disponíveis assim que terminarmos.
            </AlertDescription>
          </Alert>
        ) : null}

        {!isOwner ? (
          <Alert>
            <LockIcon />
            <AlertTitle>Somente leitura para o seu papel</AlertTitle>
            <AlertDescription>
              Só o dono da imobiliária pode assinar, trocar de plano ou alterar o pagamento.
            </AlertDescription>
          </Alert>
        ) : null}

        {overview && stateMessage ? (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Situação</CardTitle>
                  <CardDescription>{stateMessage.title}</CardDescription>
                  <CardAction>
                    <BillingStateBadge state={overview.state} />
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p>{stateMessage.description}</p>
                  {overview.state === "read_only" ? <ReadOnlyDetails /> : null}
                </CardContent>
                {isOwner && overview.state !== "active" ? (
                  <CardFooter className="flex-wrap gap-2">
                    {overview.state === "grace" && overview.hasSubscription ? (
                      <BillingPortalButton
                        flow="payment_method_update"
                        variant="default"
                        disabled={!stripeConfigured}
                      >
                        Atualizar forma de pagamento
                      </BillingPortalButton>
                    ) : (
                      <Button render={<a href="#planos" />} nativeButton={false}>
                        Escolher um plano
                      </Button>
                    )}
                  </CardFooter>
                ) : null}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Plano atual</CardTitle>
                  <CardDescription>Resumo do que está contratado.</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
                    <dt className="text-muted-foreground">Plano</dt>
                    <dd className="font-medium">{planDisplayName(overview.planKey)}</dd>
                    <dt className="text-muted-foreground">Cobrança</dt>
                    <dd>
                      {overview.interval ? BILLING_INTERVAL_LABELS[overview.interval].label : "—"}
                    </dd>
                    <dt className="text-muted-foreground">Usuários contratados</dt>
                    <dd>{pluralize(overview.seats, "usuário", "usuários")}</dd>
                    {overview.hasSubscription ? null : (
                      <>
                        <dt className="text-muted-foreground">Teste grátis até</dt>
                        <dd>{formatDate(overview.trialEndsAt)}</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Próxima cobrança</dt>
                    <dd>{nextChargeLabel(overview)}</dd>
                  </dl>
                </CardContent>
                {isOwner ? (
                  <CardFooter className="flex-col items-start gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <BillingPortalButton
                        disabled={!portalAvailable}
                        describedBy={portalAvailable ? undefined : "portal-indisponivel"}
                      />
                      {overview.hasSubscription && !overview.cancelAtPeriodEnd ? (
                        <BillingPortalButton
                          flow="subscription_cancel"
                          variant="ghost"
                          disabled={!stripeConfigured}
                        >
                          Cancelar assinatura
                        </BillingPortalButton>
                      ) : null}
                    </div>
                    {portalAvailable ? null : (
                      <p id="portal-indisponivel" className="text-sm text-muted-foreground">
                        {stripeConfigured
                          ? "Disponível depois da primeira assinatura."
                          : "Disponível quando os pagamentos estiverem configurados."}
                      </p>
                    )}
                  </CardFooter>
                ) : null}
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Uso do plano</CardTitle>
                <CardDescription>
                  O banco bloqueia novos usuários e publicações acima do limite; nada é apagado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UsageMeters overview={overview} upgradeHref={isOwner ? "#planos" : undefined} />
              </CardContent>
            </Card>

            <Card id="planos" className="scroll-mt-4">
              <CardHeader>
                <CardTitle>
                  {overview.hasSubscription ? "Trocar de plano" : "Escolher um plano"}
                </CardTitle>
                <CardDescription>
                  Upgrade na hora, com cobrança proporcional. Downgrade no próximo ciclo, sem apagar
                  nada.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PlanSwitcher
                  prices={prices}
                  currentPlanKey={overview.planKey}
                  currentInterval={overview.interval}
                  currentSeats={overview.seats}
                  usersInUse={overview.usage.users}
                  currentPeriodEnd={overview.currentPeriodEnd}
                  hasSubscription={overview.hasSubscription}
                  canManage={isOwner}
                  stripeConfigured={stripeConfigured}
                />
              </CardContent>
            </Card>
          </>
        ) : (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Não foi possível carregar a assinatura</AlertTitle>
            <AlertDescription>
              Recarregue a página em instantes. Seus dados e o acesso ao CRM não foram afetados.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Faturas recentes</CardTitle>
            <CardDescription>Últimas cobranças, lidas direto da Stripe.</CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesResult.ok ? (
              <InvoicesList
                invoices={invoicesResult.invoices}
                stripeConfigured={stripeConfigured}
              />
            ) : (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>Faturas indisponíveis no momento</AlertTitle>
                <AlertDescription>
                  Tente de novo em instantes
                  {isOwner && portalAvailable ? " ou abra o portal de pagamento" : ""}.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add-ons</CardTitle>
            <CardDescription>
              Extras que chegam em breve, com os preços já definidos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddonsList />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
