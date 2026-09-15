"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon, MinusIcon, PlusIcon, SparklesIcon } from "lucide-react"

import { formatBRL, PLANS, recommendPlan, TRIAL_DAYS } from "@workspace/core/billing"
import { Badge } from "@workspace/ui/components/badge"
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Separator } from "@workspace/ui/components/separator"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import {
  pluralize,
  resolvePlanPricing,
  signUpHref,
  totalWithSeats,
  type CatalogPrices,
} from "@/components/billing/plan-content"

const MAX_TEAM_SIZE = 500

/** Faixas alinhadas à regra do core (acima de 300 leads/mês sobe para o Equipe). */
const LEAD_OPTIONS = [
  { value: "50", label: "Até 50" },
  { value: "150", label: "51 a 150" },
  { value: "300", label: "151 a 300" },
  { value: "600", label: "Mais de 300" },
] as const

type LeadOption = (typeof LEAD_OPTIONS)[number]["value"]

function isLeadOption(value: unknown): value is LeadOption {
  return LEAD_OPTIONS.some((option) => option.value === value)
}

function parseTeamSize(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(MAX_TEAM_SIZE, Math.max(1, parsed)) : 1
}

export function PlanRecommender({ prices }: { prices: CatalogPrices }) {
  const teamSizeId = React.useId()
  const [teamSizeInput, setTeamSizeInput] = React.useState("3")
  const [doesRentals, setDoesRentals] = React.useState(false)
  const [leads, setLeads] = React.useState<LeadOption>("150")

  const teamSize = parseTeamSize(teamSizeInput)
  const recommendation = recommendPlan({
    teamSize,
    doesRentals,
    leadsPerMonth: Number(leads),
  })
  const plan = PLANS[recommendation.plan]
  const { extraSeats } = recommendation
  const monthly = resolvePlanPricing(prices, recommendation.plan, "month")
  const yearly = resolvePlanPricing(prices, recommendation.plan, "year")
  const monthlyTotal = totalWithSeats(monthly, extraSeats)
  const yearlyTotal = totalWithSeats(yearly, extraSeats)
  const yearlySavings = Math.max(0, monthlyTotal * 12 - yearlyTotal)

  const aiConversations = plan.limits.ai_conversations
  const rentalContracts = plan.limits.rental_contracts
  const reasons = [...recommendation.reasons]

  if (doesRentals && rentalContracts !== 0) {
    reasons.push(
      rentalContracts < 0
        ? "Contratos de locação ilimitados (módulo em breve)."
        : `Inclui ${pluralize(rentalContracts, "contrato de locação ativo", "contratos de locação ativos")} (módulo em breve).`
    )
  }

  if (aiConversations > 0) {
    reasons.push(
      `${pluralize(aiConversations, "conversa", "conversas")} de IA no WhatsApp por mês (em breve).${
        Number(leads) > aiConversations
          ? " Acima da franquia, o lead passa para um corretor e nunca fica sem resposta."
          : ""
      }`
    )
  }

  function stepTeamSize(delta: number) {
    setTeamSizeInput(String(parseTeamSize(String(teamSize + delta))))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>
            <h3>Conte sobre a sua operação</h3>
          </CardTitle>
          <CardDescription>Três respostas rápidas. A sugestão muda na hora.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={teamSizeId}>Quantas pessoas vão usar o CRM?</FieldLabel>
              <InputGroup className="w-40">
                <InputGroupAddon align="inline-start">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Diminuir uma pessoa"
                    disabled={teamSize <= 1}
                    onClick={() => stepTeamSize(-1)}
                  >
                    <MinusIcon />
                  </InputGroupButton>
                </InputGroupAddon>
                <InputGroupInput
                  id={teamSizeId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_TEAM_SIZE}
                  value={teamSizeInput}
                  onChange={(event) => setTeamSizeInput(event.target.value)}
                  onBlur={() => setTeamSizeInput(String(teamSize))}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Aumentar uma pessoa"
                    disabled={teamSize >= MAX_TEAM_SIZE}
                    onClick={() => stepTeamSize(1)}
                  >
                    <PlusIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>Corretores, gerentes, assistentes e financeiro.</FieldDescription>
            </Field>

            <FieldSet>
              <FieldLegend>A imobiliária faz locação?</FieldLegend>
              <ToggleGroup
                aria-label="A imobiliária faz locação?"
                variant="outline"
                value={[doesRentals ? "sim" : "nao"]}
                onValueChange={(next) => {
                  if (next[0] === "sim" || next[0] === "nao") {
                    setDoesRentals(next[0] === "sim")
                  }
                }}
              >
                <ToggleGroupItem value="sim">Sim</ToggleGroupItem>
                <ToggleGroupItem value="nao">Não</ToggleGroupItem>
              </ToggleGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Quantos leads chegam por mês?</FieldLegend>
              <ToggleGroup
                aria-label="Quantos leads chegam por mês?"
                variant="outline"
                className="flex-wrap"
                value={[leads]}
                onValueChange={(next) => {
                  if (isLeadOption(next[0])) {
                    setLeads(next[0])
                  }
                }}
              >
                {LEAD_OPTIONS.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>
                Somando portais, site, landing pages e redes sociais.
              </FieldDescription>
            </FieldSet>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Plano sugerido</CardDescription>
          <CardTitle>
            <h3 className="text-xl font-semibold">{plan.name}</h3>
          </CardTitle>
          <CardAction>
            <Badge variant="secondary">
              <SparklesIcon data-icon="inline-start" />
              Sugestão
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <p className="sr-only" aria-live="polite">
            {`Plano sugerido: ${plan.name}, ${formatBRL(monthlyTotal, { omitZeroCents: true })} por mês.`}
          </p>
          <div className="flex flex-col gap-2">
            <p className="font-medium">Por que este plano</p>
            <ul className="flex list-disc flex-col gap-1 ps-5 text-muted-foreground">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <Separator />

          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Plano {plan.name}</dt>
            <dd className="text-end tabular-nums">
              {formatBRL(monthly.price, { omitZeroCents: true })}/mês
            </dd>
            {extraSeats > 0 ? (
              <>
                <dt className="text-muted-foreground">
                  {pluralize(extraSeats, "usuário extra", "usuários extras")}
                </dt>
                <dd className="text-end tabular-nums">
                  {extraSeats} × {formatBRL(monthly.seatPrice, { omitZeroCents: true })}/mês
                </dd>
              </>
            ) : null}
            <dt className="font-medium">Total mensal</dt>
            <dd className="text-end font-medium tabular-nums">
              {formatBRL(monthlyTotal, { omitZeroCents: true })}/mês
            </dd>
            <dt className="text-muted-foreground">No anual</dt>
            <dd className="text-end tabular-nums">
              {formatBRL(yearlyTotal, { omitZeroCents: true })}/ano
            </dd>
            <dt className="text-muted-foreground">Economia no anual</dt>
            <dd className="text-end tabular-nums">
              {formatBRL(yearlySavings, { omitZeroCents: true })}
            </dd>
          </dl>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full sm:w-auto"
            render={<Link href={signUpHref(recommendation.plan)} />}
            nativeButton={false}
          >
            Testar o {plan.name} por {TRIAL_DAYS} dias
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
