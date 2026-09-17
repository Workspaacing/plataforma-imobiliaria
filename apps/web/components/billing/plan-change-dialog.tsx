"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CircleAlertIcon, MinusIcon, PlusIcon } from "lucide-react"

import {
  BILLING_INTERVAL_LABELS,
  clampExtraSeats,
  formatBRL,
  maxExtraSeats,
  PLANS,
  type BillingInterval,
  type PlanKey,
} from "@workspace/core/billing"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { BillingIntervalToggle } from "@/components/billing/billing-interval-toggle"
import {
  monthlyEquivalent,
  pluralize,
  resolvePlanPricing,
  totalWithSeats,
  type CatalogPrices,
} from "@/components/billing/plan-content"
import {
  currentExtraSeats,
  currentPaidPlan,
  type PricingAccount,
  type PricingBilling,
} from "@/components/billing/pricing-account"
import { useBillingRedirect } from "@/components/billing/use-billing-redirect"
import { changeSubscription, startCheckout } from "@/lib/billing/actions"
import { formatDate } from "@/lib/format"

/** Teto da tela; o servidor aceita até 500 e o plano pode limitar antes (clampExtraSeats). */
const MAX_EXTRA_SEATS = 200

type Choice = { plan: PlanKey; interval: BillingInterval; extraSeats: number }

type PlanChangeDialogProps = {
  open: boolean
  plan: PlanKey
  initialInterval: BillingInterval
  prices: CatalogPrices
  account: PricingAccount
  billing: PricingBilling
  onOpenChange: (open: boolean) => void
}

function parseExtraSeats(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(MAX_EXTRA_SEATS, Math.max(0, parsed)) : 0
}

/** Custo mensal equivalente, para saber se a troca aumenta ou reduz a assinatura. */
function monthlyCost(prices: CatalogPrices, choice: Choice) {
  const total = totalWithSeats(
    resolvePlanPricing(prices, choice.plan, choice.interval),
    choice.extraSeats
  )
  return choice.interval === "year" ? total / 12 : total
}

/** Mensagens de erro sobre usuários ganham o atalho para a Equipe. */
function isUsersError(message: string) {
  return /usuári|membro|convite|acesso/i.test(message)
}

/**
 * Confirmação de assinatura (Checkout da Stripe) ou de troca de plano, período e
 * usuários extras (changeSubscription), com o total antes de qualquer cobrança.
 */
export function PlanChangeDialog({
  open,
  plan,
  initialInterval,
  prices,
  account,
  billing,
  onOpenChange,
}: PlanChangeDialogProps) {
  const router = useRouter()
  const seatsId = React.useId()
  const currentPlan = currentPaidPlan(billing)
  const currentSeats = currentExtraSeats(billing)
  const hasSubscription = billing.hasSubscription
  const details = PLANS[plan]
  const seatLimit = Math.min(MAX_EXTRA_SEATS, maxExtraSeats(plan))

  const [interval, setBillingInterval] = React.useState<BillingInterval>(initialInterval)
  const [extraSeatsInput, setExtraSeatsInput] = React.useState(
    String(hasSubscription ? clampExtraSeats(plan, currentSeats) : 0)
  )
  const [error, setError] = React.useState<string | null>(null)
  const [isChanging, startChange] = React.useTransition()
  const { busy, run } = useBillingRedirect()

  const extraSeats = Math.min(seatLimit, parseExtraSeats(extraSeatsInput))
  const choice: Choice = { plan, interval, extraSeats }
  const pricing = resolvePlanPricing(prices, plan, interval)
  const total = totalWithSeats(pricing, extraSeats)
  const suffix = BILLING_INTERVAL_LABELS[interval].suffix
  const users = details.usersIncluded + extraSeats
  const belowUsage = users < billing.usersInUse
  const unchanged =
    hasSubscription &&
    plan === currentPlan &&
    interval === billing.interval &&
    extraSeats === currentSeats
  const locked = isChanging || busy !== null
  const organizationName =
    account.organizations.find((organization) => organization.id === account.selectedOrganizationId)
      ?.name ?? null
  // A imobiliária mostrada na página (o servidor confere se o usuário é dono dela)
  // e o retorno da Stripe para /planos.
  const target = {
    organizationId: account.selectedOrganizationId ?? undefined,
    returnTo: "planos",
  } as const

  let kind: "upgrade" | "downgrade" | "mixed" = "mixed"

  if (currentPlan && billing.interval) {
    const before = monthlyCost(prices, {
      plan: currentPlan,
      interval: billing.interval,
      extraSeats: currentSeats,
    })
    const after = monthlyCost(prices, choice)
    kind = after > before ? "upgrade" : after < before ? "downgrade" : "mixed"
  }

  const title = hasSubscription
    ? plan === currentPlan
      ? `Alterar o plano ${details.name}`
      : `Trocar para o plano ${details.name}`
    : `Assinar o plano ${details.name}`

  function handleOpenChange(next: boolean) {
    if (!next && locked) {
      return
    }

    onOpenChange(next)
  }

  function confirm() {
    setError(null)

    if (!hasSubscription) {
      void run(
        plan,
        () => startCheckout({ planKey: plan, interval, extraSeats, ...target }),
        "Não foi possível iniciar o pagamento"
      )
      return
    }

    startChange(async () => {
      try {
        const result = await changeSubscription({ planKey: plan, interval, extraSeats, ...target })

        if (!result.ok) {
          setError(result.error)
          return
        }

        toast.add(
          result.effective === "now"
            ? {
                type: "success",
                title: "Assinatura atualizada",
                description:
                  "A mudança já vale. A diferença proporcional entra na cobrança de hoje.",
              }
            : {
                type: "success",
                title: "Mudança agendada",
                description: `Vale a partir de ${formatDate(billing.currentPeriodEnd)}. Até lá, nada muda.`,
              }
        )
        onOpenChange(false)
        router.refresh()
      } catch {
        setError("Não foi possível falar com o servidor. Tente de novo em instantes.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {organizationName ? `Assinatura de ${organizationName}. ` : ""}
            {hasSubscription
              ? "Confira o total antes de confirmar."
              : "Você confirma o pagamento na página segura da Stripe."}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldTitle>Período de cobrança</FieldTitle>
            <BillingIntervalToggle
              value={interval}
              onValueChange={setBillingInterval}
              disabled={locked}
            />
          </Field>

          {seatLimit > 0 ? (
            <Field>
              <FieldLabel htmlFor={seatsId}>Usuários extras</FieldLabel>
              <InputGroup className="w-36">
                <InputGroupAddon align="inline-start">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Remover um usuário extra"
                    disabled={extraSeats <= 0 || locked}
                    onClick={() => setExtraSeatsInput(String(Math.max(0, extraSeats - 1)))}
                  >
                    <MinusIcon />
                  </InputGroupButton>
                </InputGroupAddon>
                <InputGroupInput
                  id={seatsId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={seatLimit}
                  value={extraSeatsInput}
                  disabled={locked}
                  onChange={(event) => setExtraSeatsInput(event.target.value)}
                  onBlur={() => setExtraSeatsInput(String(extraSeats))}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Adicionar um usuário extra"
                    disabled={extraSeats >= seatLimit || locked}
                    onClick={() => setExtraSeatsInput(String(Math.min(seatLimit, extraSeats + 1)))}
                  >
                    <PlusIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {pluralize(details.usersIncluded, "usuário incluído", "usuários incluídos")} no
                plano. Hoje a equipe usa {pluralize(billing.usersInUse, "usuário", "usuários")},
                entre membros ativos e convites pendentes.
              </FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>

        <Separator />

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">Plano {details.name}</dt>
          <dd className="text-end tabular-nums">
            {formatBRL(pricing.price, { omitZeroCents: true })}
            {suffix}
          </dd>
          {extraSeats > 0 ? (
            <>
              <dt className="text-muted-foreground">
                {pluralize(extraSeats, "usuário extra", "usuários extras")}
              </dt>
              <dd className="text-end tabular-nums">
                {extraSeats} × {formatBRL(pricing.seatPrice, { omitZeroCents: true })}
                {suffix}
              </dd>
            </>
          ) : null}
          <dt className="font-medium">Total com {pluralize(users, "usuário", "usuários")}</dt>
          <dd className="text-end font-medium tabular-nums">
            {formatBRL(total, { omitZeroCents: true })}
            {suffix}
          </dd>
          {interval === "year" ? (
            <>
              <dt className="text-muted-foreground">Equivale a</dt>
              <dd className="text-end tabular-nums">
                {formatBRL(monthlyEquivalent({ price: total, seatPrice: 0 }, "year"), {
                  omitZeroCents: true,
                })}
                /mês
              </dd>
            </>
          ) : null}
        </dl>

        <ul className="flex list-disc flex-col gap-1 ps-5 text-muted-foreground">
          {hasSubscription ? (
            <>
              {kind !== "downgrade" ? (
                <li>
                  Aumentos valem na hora: cobramos hoje a diferença proporcional ao tempo que falta
                  no ciclo.
                </li>
              ) : null}
              {kind !== "upgrade" ? (
                <li>
                  Reduções valem no fim do ciclo atual
                  {billing.currentPeriodEnd ? ` (${formatDate(billing.currentPeriodEnd)})` : ""}.
                  Até lá, nada muda.
                </li>
              ) : null}
            </>
          ) : (
            <li>O plano é liberado assim que a Stripe confirmar o pagamento.</li>
          )}
          <li>Nenhum dado é apagado.</li>
        </ul>

        {unchanged ? (
          <p className="text-muted-foreground" role="status">
            Essa já é a configuração atual da assinatura.
          </p>
        ) : null}

        {belowUsage ? (
          <Alert variant={hasSubscription ? "destructive" : "default"}>
            <CircleAlertIcon />
            <AlertTitle>Usuários insuficientes</AlertTitle>
            <AlertDescription>
              A equipe usa {pluralize(billing.usersInUse, "usuário", "usuários")} e a{" "}
              {hasSubscription ? "nova assinatura" : "assinatura"} teria {users}.{" "}
              {hasSubscription
                ? `Aumente os usuários extras ou remova ${pluralize(billing.usersInUse - users, "acesso", "acessos")}.`
                : "Acima do limite, novos usuários ficam bloqueados; nada é apagado."}{" "}
              <a href={account.teamSettingsHref}>Gerenciar a equipe</a>
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>
              {hasSubscription
                ? "Não foi possível mudar a assinatura"
                : "Não foi possível iniciar o pagamento"}
            </AlertTitle>
            <AlertDescription>
              {error}
              {isUsersError(error) ? (
                <>
                  {" "}
                  <a href={account.teamSettingsHref}>Gerenciar a equipe</a>
                </>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={locked}>
            Voltar
          </DialogClose>
          <Button
            type="button"
            onClick={confirm}
            disabled={locked || unchanged || (hasSubscription && belowUsage)}
          >
            {locked ? <Spinner data-icon="inline-start" aria-label="Aguarde" /> : null}
            {hasSubscription ? "Confirmar mudança" : "Ir para o pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
