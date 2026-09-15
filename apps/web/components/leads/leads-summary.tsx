import { CalendarDaysIcon, InboxIcon, TimerIcon, TrophyIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "cn"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@workspace/ui/components/card"

import { LEAD_RESPONSE_TARGET_MINUTES } from "@/lib/leads/constants"
import type { LeadSummaryCounts } from "@/lib/leads/types"

const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
})
const integer = new Intl.NumberFormat("pt-BR")

type LeadsSummaryProps = {
  counts: LeadSummaryCounts
  wonCount: number
  totalCount: number
  periodLabel: string
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  highlight,
}: {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  highlight?: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction>
          <Icon
            aria-hidden
            className={cn("size-4 text-muted-foreground", highlight && "text-destructive")}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className={cn("text-2xl font-semibold tabular-nums", highlight && "text-destructive")}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

/** Resumo do topo: prazo de primeiro contato, novos sem contato, leads de hoje e conversão. */
export function LeadsSummary({ counts, wonCount, totalCount, periodLabel }: LeadsSummaryProps) {
  const show = (value: number) => (counts.failed ? "—" : integer.format(value))

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="Leads novos fora do prazo"
        value={show(counts.overdue)}
        hint={`Sem contato há mais de ${LEAD_RESPONSE_TARGET_MINUTES} min.`}
        icon={TimerIcon}
        highlight={!counts.failed && counts.overdue > 0}
      />
      <SummaryCard
        label="Leads novos sem contato"
        value={show(counts.newWithoutContact)}
        hint="Na etapa Novo, aguardando o primeiro contato."
        icon={InboxIcon}
      />
      <SummaryCard
        label="Leads de hoje"
        value={show(counts.today)}
        hint="Entraram desde 00:00 (horário de Brasília)."
        icon={CalendarDaysIcon}
      />
      <SummaryCard
        label="Taxa de conversão"
        value={totalCount > 0 ? percent.format(wonCount / totalCount) : "—"}
        hint={`${integer.format(wonCount)} ganho(s) de ${integer.format(totalCount)} lead(s) · ${periodLabel.toLocaleLowerCase("pt-BR")}.`}
        icon={TrophyIcon}
      />
    </div>
  )
}
