import { CheckIcon, MinusIcon } from "lucide-react"

import {
  FEATURE_GROUPS,
  FEATURE_KEYS,
  FEATURES,
  formatBRL,
  formatLimit,
  LIMIT_KEYS,
  LIMITS,
  LISTING_PHOTO_MAX_MB,
  maxExtraSeats,
  PLAN_KEYS,
  PLANS,
  type LimitKey,
  type PlanKey,
} from "@workspace/core/billing"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { resolvePlanPricing, type CatalogPrices } from "@/components/billing/plan-content"

type Cell = { kind: "text"; text: string } | { kind: "included"; included: boolean }

type ComparisonRow = {
  id: string
  label: string
  soon: boolean
  cells: Record<PlanKey, Cell>
}

type ComparisonGroup = { title: string; rows: ComparisonRow[] }

function byPlan(build: (plan: PlanKey) => Cell): Record<PlanKey, Cell> {
  return Object.fromEntries(PLAN_KEYS.map((plan) => [plan, build(plan)])) as Record<PlanKey, Cell>
}

function text(value: string): Cell {
  return { kind: "text", text: value }
}

function limitText(key: LimitKey, value: number) {
  // Locação no Corretor é vendida só como add-on.
  if (key === "rental_contracts" && value === 0) {
    return "Add-on"
  }

  return formatLimit(value, LIMITS[key].unit)
}

function buildGroups(prices: CatalogPrices): ComparisonGroup[] {
  const limitRows: ComparisonRow[] = [
    {
      id: "records",
      label: "Imóveis, condomínios e clientes",
      soon: false,
      cells: byPlan(() => text("Ilimitado")),
    },
    ...LIMIT_KEYS.map((key) => ({
      id: `limit-${key}`,
      label: key === "users" ? "Usuários incluídos" : LIMITS[key].label,
      soon: LIMITS[key].status === "soon",
      cells: byPlan((plan) => text(limitText(key, PLANS[plan].limits[key]))),
    })),
    {
      // Igual em todos os planos: não é chave de `limits`, é constante do produto.
      id: "photo-size",
      label: "Tamanho máximo por foto",
      soon: false,
      cells: byPlan(() => text(`${LISTING_PHOTO_MAX_MB} MB`)),
    },
    {
      id: "seat",
      label: "Usuário extra",
      soon: false,
      cells: byPlan((plan) => {
        const max = maxExtraSeats(plan)
        const price = `${formatBRL(resolvePlanPricing(prices, plan, "month").seatPrice, {
          omitZeroCents: true,
        })}/mês`

        if (max === 0) return text("Não incluso")
        return text(Number.isFinite(max) ? `${price} (até ${max})` : price)
      }),
    },
  ]

  const featureGroups = FEATURE_GROUPS.map((group) => ({
    title: group,
    rows: FEATURE_KEYS.filter((key) => FEATURES[key].group === group).map((key) => {
      const feature = FEATURES[key]

      return {
        id: key,
        label: feature.label,
        soon: feature.status === "soon",
        cells: byPlan((plan) => {
          const note = feature.notes?.[plan]
          return note ? text(note) : { kind: "included", included: feature.plans.includes(plan) }
        }),
      }
    }),
  })).filter((group) => group.rows.length > 0)

  return [{ title: "Limites e usuários", rows: limitRows }, ...featureGroups]
}

function CellValue({ cell }: { cell: Cell }) {
  if (cell.kind === "text") {
    return <span>{cell.text}</span>
  }

  return cell.included ? (
    <>
      <CheckIcon aria-hidden="true" className="size-4 text-primary" />
      <span className="sr-only">Incluso</span>
    </>
  ) : (
    <>
      <MinusIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      <span className="sr-only">Não incluso</span>
    </>
  )
}

function RowLabel({ row }: { row: ComparisonRow }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {row.label}
      {row.soon ? <Badge variant="outline">Em breve</Badge> : null}
    </span>
  )
}

/** Tabela comparativa no desktop; no celular, um acordeão por plano (sem rolagem lateral). */
export function PlanComparison({ prices }: { prices: CatalogPrices }) {
  const groups = buildGroups(prices)

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableCaption className="sr-only">
            Comparação de limites e recursos entre os planos
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Recurso</TableHead>
              {PLAN_KEYS.map((plan) => (
                <TableHead key={plan} scope="col" className="w-36 text-center">
                  {PLANS[plan].name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          {groups.map((group) => (
            <TableBody key={group.title}>
              <TableRow>
                <TableHead
                  scope="colgroup"
                  colSpan={PLAN_KEYS.length + 1}
                  className="pt-6 text-muted-foreground"
                >
                  {group.title}
                </TableHead>
              </TableRow>
              {group.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableHead scope="row" className="font-normal whitespace-normal">
                    <RowLabel row={row} />
                  </TableHead>
                  {PLAN_KEYS.map((plan) => (
                    <TableCell key={plan} className="text-center whitespace-normal">
                      <span className="inline-flex items-center justify-center">
                        <CellValue cell={row.cells[plan]} />
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </div>

      <Accordion className="md:hidden">
        {PLAN_KEYS.map((plan) => (
          <AccordionItem key={plan} value={plan}>
            <AccordionTrigger>Plano {PLANS[plan].name}</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-5">
                {groups.map((group) => (
                  <div key={group.title} className="flex flex-col gap-2">
                    <h4 className="font-medium">{group.title}</h4>
                    <dl className="flex flex-col gap-2">
                      {group.rows.map((row) => (
                        <div key={row.id} className="flex items-start justify-between gap-4">
                          <dt className="text-muted-foreground">
                            <RowLabel row={row} />
                          </dt>
                          <dd className="flex shrink-0 items-center text-end">
                            <CellValue cell={row.cells[plan]} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  )
}
