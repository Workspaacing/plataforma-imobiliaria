"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleAlertIcon, MinusIcon, PlusIcon } from "lucide-react"

import {
  BILLING_INTERVAL_LABELS,
  clampExtraSeats,
  formatBRL,
  isPlanKey,
  PLAN_KEYS,
  PLANS,
  type BillingInterval,
  type BillingPlanKey,
  type PlanKey,
} from "@workspace/core/billing"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { BillingIntervalToggle } from "@/components/billing/billing-interval-toggle"
import { PlanCard } from "@/components/billing/plan-card"
import {
  pluralize,
  resolvePlanPricing,
  totalWithSeats,
  type CatalogPrices,
} from "@/components/billing/plan-content"
import { useBillingRedirect } from "@/components/billing/use-billing-redirect"
import { changeSubscription, startCheckout } from "@/lib/billing/actions"
import { formatDate } from "@/lib/format"

const MAX_EXTRA_SEATS = 200
const TEAM_SETTINGS_PATH = "/configuracoes/equipe"

type PlanSwitcherProps = {
  prices: CatalogPrices
  currentPlanKey: BillingPlanKey
  currentInterval: BillingInterval | null
  /** Usuários contratados hoje (incluídos + extras). */
  currentSeats: number
  /** Membros ativos + convites pendentes: o novo total não pode ficar abaixo. */
  usersInUse: number
  currentPeriodEnd: string | null
  /** Assinatura na Stripe: troca dentro do app; sem ela, Checkout. */
  hasSubscription: boolean
  /** Só o dono assina ou troca de plano. */
  canManage: boolean
  stripeConfigured: boolean
}

type Choice = { plan: PlanKey; interval: BillingInterval; extraSeats: number }

type ChangeKind = "upgrade" | "downgrade" | "mixed"

function parseExtraSeats(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(MAX_EXTRA_SEATS, Math.max(0, parsed)) : 0
}

/** Custo mensal equivalente, para estimar se a troca aumenta ou reduz a assinatura. */
function monthlyCost(prices: CatalogPrices, choice: Choice) {
  const total = totalWithSeats(
    resolvePlanPricing(prices, choice.plan, choice.interval),
    choice.extraSeats
  )
  return choice.interval === "year" ? total / 12 : total
}

function describeChoice(choice: Choice) {
  const users = PLANS[choice.plan].usersIncluded + choice.extraSeats
  return `${PLANS[choice.plan].name} ${BILLING_INTERVAL_LABELS[choice.interval].label.toLowerCase()}, ${pluralize(users, "usuário", "usuários")}`
}

/** Mensagens de erro sobre usuários ganham o atalho para a Equipe. */
function isUsersError(message: string) {
  return /usuári|membro|convite|acesso/i.test(message)
}

export function PlanSwitcher({
  prices,
  currentPlanKey,
  currentInterval,
  currentSeats,
  usersInUse,
  currentPeriodEnd,
  hasSubscription,
  canManage,
  stripeConfigured,
}: PlanSwitcherProps) {
  const router = useRouter()
  const seatsId = React.useId()
  const hintId = React.useId()
  const currentPlan = isPlanKey(currentPlanKey) ? currentPlanKey : null
  const currentExtraSeats = currentPlan
    ? Math.max(0, currentSeats - PLANS[currentPlan].usersIncluded)
    : 0

  const [interval, setBillingInterval] = React.useState<BillingInterval>(currentInterval ?? "month")
  const [extraSeatsInput, setExtraSeatsInput] = React.useState(
    String(hasSubscription ? currentExtraSeats : 0)
  )
  const [pending, setPending] = React.useState<Choice | null>(null)
  const [changeError, setChangeError] = React.useState<string | null>(null)
  const [isChanging, startChange] = React.useTransition()
  const { busy, run } = useBillingRedirect()

  const extraSeats = parseExtraSeats(extraSeatsInput)
  const locked = busy !== null || isChanging

  const hint = !canManage
    ? "Só o dono da imobiliária pode assinar ou trocar de plano."
    : !stripeConfigured
      ? "Os pagamentos estão em configuração. Assinar e trocar de plano ficam disponíveis assim que terminarmos."
      : hasSubscription
        ? "Escolha o plano, o período e os usuários extras. Você confirma a mudança antes de qualquer cobrança."
        : "Você vai para o pagamento seguro da Stripe. O plano é liberado assim que o pagamento for confirmado."

  function isCurrentChoice(choice: Choice) {
    return (
      hasSubscription &&
      choice.plan === currentPlan &&
      choice.interval === currentInterval &&
      choice.extraSeats === currentExtraSeats
    )
  }

  function choosePlan(plan: PlanKey) {
    const choice: Choice = { plan, interval, extraSeats: clampExtraSeats(plan, extraSeats) }

    if (hasSubscription) {
      setChangeError(null)
      setPending(choice)
      return
    }

    void run(
      plan,
      () => startCheckout({ planKey: plan, interval, extraSeats: choice.extraSeats }),
      "Não foi possível iniciar o pagamento"
    )
  }

  function confirmChange() {
    if (!pending) {
      return
    }

    const choice = pending

    startChange(async () => {
      try {
        const result = await changeSubscription({
          planKey: choice.plan,
          interval: choice.interval,
          extraSeats: choice.extraSeats,
        })

        if (!result.ok) {
          setChangeError(result.error)
          return
        }

        setPending(null)
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
                description: `Vale a partir de ${formatDate(currentPeriodEnd)}. Até lá, nada muda.`,
              }
        )
        router.refresh()
      } catch {
        setChangeError("Não foi possível falar com o servidor. Tente de novo em instantes.")
      }
    })
  }

  const pendingUsers = pending ? PLANS[pending.plan].usersIncluded + pending.extraSeats : 0
  const pendingBelowUsage = pending !== null && pendingUsers < usersInUse
  let pendingKind: ChangeKind = "mixed"

  if (pending && currentPlan && currentInterval) {
    const before = monthlyCost(prices, {
      plan: currentPlan,
      interval: currentInterval,
      extraSeats: currentExtraSeats,
    })
    const after = monthlyCost(prices, pending)
    pendingKind = after > before ? "upgrade" : after < before ? "downgrade" : "mixed"
  }

  return (
    <div className="flex flex-col gap-6">
      <FieldGroup className="gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <Field className="sm:w-auto">
          <FieldTitle>Período de cobrança</FieldTitle>
          <BillingIntervalToggle
            value={interval}
            onValueChange={setBillingInterval}
            disabled={locked || !canManage}
          />
        </Field>

        {canManage ? (
          <Field className="sm:w-auto">
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
                max={MAX_EXTRA_SEATS}
                value={extraSeatsInput}
                disabled={locked}
                onChange={(event) => setExtraSeatsInput(event.target.value)}
                onBlur={() => setExtraSeatsInput(String(extraSeats))}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Adicionar um usuário extra"
                  disabled={extraSeats >= MAX_EXTRA_SEATS || locked}
                  onClick={() =>
                    setExtraSeatsInput(String(Math.min(MAX_EXTRA_SEATS, extraSeats + 1)))
                  }
                >
                  <PlusIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        ) : null}
      </FieldGroup>

      <p id={hintId} className="text-sm text-muted-foreground">
        {hint}
        {canManage
          ? ` Os extras somam aos usuários incluídos (no Corretor, no máximo 1). Hoje a equipe usa ${pluralize(usersInUse, "usuário", "usuários")}.`
          : ""}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {PLAN_KEYS.map((plan) => {
          const choice: Choice = { plan, interval, extraSeats: clampExtraSeats(plan, extraSeats) }
          const isCurrentPlan = hasSubscription && plan === currentPlan
          const unchanged = isCurrentChoice(choice)
          const label = unchanged
            ? "Plano atual"
            : hasSubscription
              ? isCurrentPlan
                ? "Atualizar assinatura"
                : `Mudar para ${PLANS[plan].name}`
              : `Assinar ${PLANS[plan].name}`

          return (
            <PlanCard
              key={plan}
              compact
              plan={plan}
              interval={interval}
              pricing={resolvePlanPricing(prices, plan, interval)}
              extraSeats={canManage ? choice.extraSeats : 0}
              current={isCurrentPlan}
              footer={
                canManage ? (
                  <Button
                    type="button"
                    variant={
                      PLANS[plan].highlight && !hasSubscription && !unchanged
                        ? "default"
                        : "outline"
                    }
                    disabled={!stripeConfigured || unchanged || locked}
                    aria-describedby={hintId}
                    onClick={() => choosePlan(plan)}
                  >
                    {busy === plan ? (
                      <Spinner data-icon="inline-start" aria-label="Abrindo" />
                    ) : null}
                    {label}
                  </Button>
                ) : undefined
              }
            />
          )
        })}
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !isChanging) {
            setPending(null)
            setChangeError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar a mudança de assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? (
                <>
                  {currentPlan && currentInterval
                    ? `De ${describeChoice({ plan: currentPlan, interval: currentInterval, extraSeats: currentExtraSeats })} `
                    : ""}
                  para {describeChoice(pending)}, por{" "}
                  {formatBRL(
                    totalWithSeats(
                      resolvePlanPricing(prices, pending.plan, pending.interval),
                      pending.extraSeats
                    ),
                    { omitZeroCents: true }
                  )}
                  {BILLING_INTERVAL_LABELS[pending.interval].suffix}.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-muted-foreground">
            {pendingKind !== "downgrade" ? (
              <li>
                Aumentos valem na hora: cobramos hoje a diferença proporcional ao tempo que falta no
                ciclo.
              </li>
            ) : null}
            {pendingKind !== "upgrade" ? (
              <li>
                Reduções valem no fim do ciclo atual
                {currentPeriodEnd ? ` (${formatDate(currentPeriodEnd)})` : ""}. Até lá, nada muda.
              </li>
            ) : null}
            <li>Nenhum dado é apagado.</li>
          </ul>

          {pendingBelowUsage ? (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Usuários insuficientes</AlertTitle>
              <AlertDescription>
                A equipe usa {pluralize(usersInUse, "usuário", "usuários")} (membros ativos e
                convites pendentes) e a nova assinatura teria {pendingUsers}. Remova{" "}
                {pluralize(usersInUse - pendingUsers, "acesso", "acessos")} ou aumente os usuários
                extras. <Link href={TEAM_SETTINGS_PATH}>Gerenciar a equipe</Link>
              </AlertDescription>
            </Alert>
          ) : null}

          {changeError ? (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Não foi possível mudar a assinatura</AlertTitle>
              <AlertDescription>
                {changeError}
                {isUsersError(changeError) ? (
                  <>
                    {" "}
                    <Link href={TEAM_SETTINGS_PATH}>Gerenciar a equipe</Link>
                  </>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isChanging}>Voltar</AlertDialogCancel>
            <Button
              type="button"
              onClick={confirmChange}
              disabled={isChanging || pendingBelowUsage}
            >
              {isChanging ? <Spinner data-icon="inline-start" aria-label="Salvando" /> : null}
              Confirmar mudança
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
