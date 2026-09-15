"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FilterXIcon, KanbanIcon, ListIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import type { MemberOption } from "@/lib/clientes/options"
import { LEAD_SOURCE_LABELS, LEAD_SOURCES, LEADS_PATH } from "@/lib/leads/constants"
import {
  buildLeadListHref,
  hasActiveLeadFilters,
  LEAD_PERIOD_LABELS,
  LEAD_PERIODS,
  MINE_FILTER,
  UNASSIGNED_FILTER,
  type LeadListFilters,
} from "@/lib/leads/filters"
import type { LeadLandingPageRef } from "@/lib/leads/types"

type Item = { label: string; value: string | null }

const SOURCE_ITEMS: Item[] = [
  { label: "Todas as origens", value: null },
  ...LEAD_SOURCES.map((source) => ({ label: LEAD_SOURCE_LABELS[source], value: source })),
]

const PERIOD_ITEMS: Item[] = LEAD_PERIODS.map((period) => ({
  label: LEAD_PERIOD_LABELS[period],
  value: period,
}))

type LeadFiltersProps = {
  filters: LeadListFilters
  members: MemberOption[]
  landingPages: LeadLandingPageRef[]
  campaigns: string[]
  /** Gestão filtra por qualquer membro; os demais só "Meus" e "Sem responsável". */
  showMemberOptions: boolean
}

function FilterSelect({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: Item[]
  value: string | null
  onChange: (value: string | null) => void
  label: string
  className: string
}) {
  return (
    <Select items={items} value={value} onValueChange={(next: string | null) => onChange(next)}>
      <SelectTrigger className={className} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value ?? "todos"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function LeadFilters({
  filters,
  members,
  landingPages,
  campaigns,
  showMemberOptions,
}: LeadFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()

  function navigate(changes: Partial<LeadListFilters>) {
    startTransition(() => {
      router.replace(buildLeadListHref({ ...filters, ...changes }), { scroll: false })
    })
  }

  const assigneeItems: Item[] = [
    { label: "Todos os responsáveis", value: null },
    { label: "Meus leads", value: MINE_FILTER },
    { label: "Sem responsável", value: UNASSIGNED_FILTER },
    ...(showMemberOptions ? members.map((member) => ({ label: member.name, value: member.id })) : []),
  ]

  if (filters.responsavel && !assigneeItems.some((item) => item.value === filters.responsavel)) {
    assigneeItems.push({ label: "Ex-membro", value: filters.responsavel })
  }

  const pageItems: Item[] = [
    { label: "Todas as páginas", value: null },
    ...landingPages.map((page) => ({ label: page.name, value: page.id })),
  ]

  const campaignItems: Item[] = [
    { label: "Todas as campanhas", value: null },
    ...campaigns.map((campaign) => ({ label: campaign, value: campaign })),
  ]

  if (filters.campanha && !campaigns.includes(filters.campanha)) {
    campaignItems.push({ label: filters.campanha, value: filters.campanha })
  }

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      <FilterSelect
        items={assigneeItems}
        value={filters.responsavel || null}
        onChange={(value) => navigate({ responsavel: value ?? "" })}
        label="Filtrar por responsável"
        className="w-full lg:w-48"
      />
      <FilterSelect
        items={SOURCE_ITEMS}
        value={filters.origem || null}
        onChange={(value) => {
          const source = LEAD_SOURCES.find((item) => item === value)
          navigate({ origem: source ?? "" })
        }}
        label="Filtrar por origem"
        className="w-full lg:w-44"
      />
      {landingPages.length > 0 ? (
        <FilterSelect
          items={pageItems}
          value={filters.pagina || null}
          onChange={(value) => navigate({ pagina: value ?? "" })}
          label="Filtrar por landing page"
          className="w-full lg:w-52"
        />
      ) : null}
      {campaignItems.length > 1 ? (
        <FilterSelect
          items={campaignItems}
          value={filters.campanha || null}
          onChange={(value) => navigate({ campanha: value ?? "" })}
          label="Filtrar por campanha UTM"
          className="w-full lg:w-48"
        />
      ) : null}
      <FilterSelect
        items={PERIOD_ITEMS}
        value={filters.periodo}
        onChange={(value) => {
          const period = LEAD_PERIODS.find((item) => item === value)
          navigate({ periodo: period ?? "todos" })
        }}
        label="Filtrar por período de entrada"
        className="w-full lg:w-44"
      />

      {hasActiveLeadFilters(filters) ? (
        <Button
          variant="ghost"
          onClick={() =>
            startTransition(() =>
              router.replace(
                filters.visao === "lista" ? `${LEADS_PATH}?visao=lista` : LEADS_PATH,
                { scroll: false }
              )
            )
          }
        >
          <FilterXIcon data-icon="inline-start" />
          Limpar filtros
        </Button>
      ) : null}

      <div className="flex items-center gap-2 lg:ms-auto">
        {isPending ? <Spinner aria-label="Atualizando" /> : null}
        <ToggleGroup
          aria-label="Visualização"
          variant="outline"
          value={[filters.visao]}
          onValueChange={(value: string[]) => {
            const view = value[0]
            if (view === "quadro" || view === "lista") navigate({ visao: view })
          }}
        >
          <ToggleGroupItem value="quadro">
            <KanbanIcon data-icon="inline-start" />
            Quadro
          </ToggleGroupItem>
          <ToggleGroupItem value="lista">
            <ListIcon data-icon="inline-start" />
            Lista
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}
