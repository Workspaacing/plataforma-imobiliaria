"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FilterXIcon, LockIcon } from "lucide-react"

import {
  DEFAULT_REPORT_PERIOD_PRESET,
  isReportPeriodPreset,
  REPORT_PERIOD_PRESET_LABELS,
  REPORT_PERIOD_PRESETS,
  type ReportPeriod,
} from "@workspace/core/reports/period"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"

import { DatePicker } from "@/components/agenda/date-picker"
import type { MemberOption } from "@/lib/clientes/options"
import { buildReportHref, type ReportTab } from "@/lib/relatorios/url"

/** Valor do select quando as datas foram escolhidas à mão. */
const CUSTOM = "personalizado"
const ALL_BROKERS = "todos"

type ReportFiltersProps = {
  period: ReportPeriod
  broker: string | null
  tab: ReportTab
  /** Equipe para o filtro. Vazia quando quem olha não pode ver a dos colegas. */
  members: MemberOption[]
  /** Dono e gerente escolhem o corretor; os demais papéis veem só o próprio. */
  canChooseBroker: boolean
  /** Nome de quem está olhando, para o campo travado dizer de quem é o número. */
  selfName: string
}

/**
 * Filtro de período e de corretor. Tudo viaja na URL (`?periodo=`, `?de=`,
 * `?ate=`, `?corretor=`), então o relatório é um link que se manda para o sócio
 * — e a exportação usa exatamente os mesmos parâmetros.
 *
 * Para quem não é dono nem gerente o campo de corretor aparece TRAVADO com o
 * próprio nome, em vez de sumir: a tela diz o recorte em que está, que é o que
 * o banco vai aplicar de qualquer jeito.
 */
export function ReportFilters({
  period,
  broker,
  tab,
  members,
  canChooseBroker,
  selfName,
}: ReportFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  // Estado local só do modo "personalizado" e das duas datas enquanto o usuário
  // escolhe a segunda. Quem sincroniza com a URL é o `key` do componente, em
  // page.tsx: período diferente remonta o filtro e o estado nasce do novo
  // período — sem efeito copiando prop para estado.
  const [custom, setCustom] = React.useState(period.preset === null)
  const [fromDay, setFromDay] = React.useState(period.fromDay)
  const [toDay, setToDay] = React.useState(period.toDay)

  function navigate(href: string) {
    startTransition(() => {
      router.replace(href, { scroll: false })
    })
  }

  function applyPeriod(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) {
      return
    }

    navigate(buildReportHref({ from: nextFrom, to: nextTo, broker, tab }))
  }

  const periodValue = period.preset ?? CUSTOM
  const periodItems = [
    ...REPORT_PERIOD_PRESETS.map((preset) => ({
      value: preset as string,
      label: REPORT_PERIOD_PRESET_LABELS[preset],
    })),
    { value: CUSTOM, label: "Período personalizado" },
  ]

  const brokerItems = [
    { value: ALL_BROKERS, label: "Toda a equipe" },
    ...members.map((member) => ({ value: member.id, label: member.name })),
  ]

  if (broker && !brokerItems.some((item) => item.value === broker)) {
    brokerItems.push({ value: broker, label: "Ex-membro" })
  }

  const hasFilters = period.preset !== DEFAULT_REPORT_PERIOD_PRESET || Boolean(broker)

  return (
    <FieldGroup className="gap-4 @2xl/page:flex-row @2xl/page:items-end">
      <Field className="@2xl/page:w-56">
        <FieldLabel htmlFor="relatorio-periodo">Período</FieldLabel>
        <Select
          items={periodItems}
          value={periodValue}
          onValueChange={(value) => {
            if (value === CUSTOM) {
              setCustom(true)
              return
            }

            if (isReportPeriodPreset(value)) {
              setCustom(false)
              navigate(buildReportHref({ preset: value, broker, tab }))
            }
          }}
        >
          <SelectTrigger id="relatorio-periodo" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {periodItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {custom ? (
        <>
          <Field className="@2xl/page:w-44">
            <FieldLabel htmlFor="relatorio-de">De</FieldLabel>
            <DatePicker
              id="relatorio-de"
              value={fromDay}
              onChange={(value) => {
                setFromDay(value)
                applyPeriod(value, toDay)
              }}
            />
          </Field>
          <Field className="@2xl/page:w-44">
            <FieldLabel htmlFor="relatorio-ate">Até</FieldLabel>
            <DatePicker
              id="relatorio-ate"
              value={toDay}
              onChange={(value) => {
                setToDay(value)
                applyPeriod(fromDay, value)
              }}
            />
          </Field>
        </>
      ) : null}

      <Field className="@2xl/page:w-60">
        <FieldLabel htmlFor="relatorio-corretor">Corretor</FieldLabel>
        {canChooseBroker ? (
          <Select
            items={brokerItems}
            value={broker ?? ALL_BROKERS}
            onValueChange={(value) => {
              const next = value === ALL_BROKERS ? null : String(value)
              navigate(
                buildReportHref({
                  preset: period.preset,
                  from: period.fromDay,
                  to: period.toDay,
                  broker: next,
                  tab,
                })
              )
            }}
          >
            <SelectTrigger id="relatorio-corretor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {brokerItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <div
            id="relatorio-corretor"
            className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground"
          >
            <LockIcon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{selfName}</span>
          </div>
        )}
      </Field>

      <div className="flex items-center gap-2 @2xl/page:pb-0.5">
        {isPending ? <Spinner className="text-muted-foreground" /> : null}
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(buildReportHref({ preset: DEFAULT_REPORT_PERIOD_PRESET, tab }))}
          >
            <FilterXIcon data-icon="inline-start" />
            Limpar
          </Button>
        ) : null}
      </div>
    </FieldGroup>
  )
}
