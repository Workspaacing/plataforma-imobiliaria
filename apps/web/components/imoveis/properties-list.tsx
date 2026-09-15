import Link from "next/link"

import { PROPERTY_TYPE_LABELS } from "@workspace/core/properties/enums"
import { Badge } from "@workspace/ui/components/badge"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { ImobScoreBadge } from "@/components/imoveis/imob-score-badge"
import { PropertyCover } from "@/components/imoveis/property-cover"
import { PropertyStatusBadge } from "@/components/imoveis/property-status-badge"
import { formatCurrency } from "@/lib/format"
import type { PropertyListItem } from "@/lib/imoveis/list-queries"
import { getDisplayPrices } from "@/lib/imoveis/mappers"

function location(item: PropertyListItem) {
  const city = [item.city, item.state].filter(Boolean).join("/")
  return [item.neighborhood, city].filter(Boolean).join(" · ") || "Endereço não informado"
}

function Prices({ item }: { item: PropertyListItem }) {
  return (
    <div className="flex flex-col gap-0.5">
      {getDisplayPrices(item).map((price) => (
        <span key={price.label} className="tabular-nums">
          <span className="text-xs text-muted-foreground">{price.label} </span>
          {formatCurrency(price.value)}
          {price.suffix && price.value != null ? (
            <span className="text-xs text-muted-foreground">{price.suffix}</span>
          ) : null}
        </span>
      ))}
    </div>
  )
}

function People({ item, memberNames }: { item: PropertyListItem; memberNames: Record<string, string> }) {
  const capturer = item.captured_by ? (memberNames[item.captured_by] ?? "Ex-membro") : "—"
  const broker = item.broker_id ? (memberNames[item.broker_id] ?? "Ex-membro") : "—"

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span className="truncate">
        <span className="text-muted-foreground">Captador: </span>
        {capturer}
      </span>
      <span className="truncate">
        <span className="text-muted-foreground">Corretor: </span>
        {broker}
      </span>
    </div>
  )
}

export function PropertiesList({
  items,
  memberNames,
}: {
  items: PropertyListItem[]
  memberNames: Record<string, string>
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24 ps-4">
                <span className="sr-only">Foto</span>
              </TableHead>
              <TableHead>Imóvel</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Nota do Anúncio</TableHead>
              <TableHead className="pe-4">Responsáveis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="ps-4">
                  <PropertyCover storagePath={item.coverPath} alt={`Capa de ${item.title}`} className="h-14 w-20" />
                </TableCell>
                <TableCell className="max-w-80 whitespace-normal">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.code} · {PROPERTY_TYPE_LABELS[item.type]}
                    </span>
                    <Link href={`/imoveis/${item.id}`} className="line-clamp-2 font-medium hover:underline">
                      {item.title}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">{location(item)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Prices item={item} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <PropertyStatusBadge status={item.status} />
                    {item.published_to_portals ? <Badge variant="outline">Nos portais</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <ImobScoreBadge score={item.imob_score} />
                </TableCell>
                <TableCell className="max-w-56 pe-4">
                  <People item={item} memberNames={memberNames} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ItemGroup className="gap-2 md:hidden">
        {items.map((item) => (
          <Item key={item.id} variant="outline" render={<Link href={`/imoveis/${item.id}`} />}>
            <ItemMedia variant="image" className="size-20">
              <PropertyCover storagePath={item.coverPath} alt={`Capa de ${item.title}`} className="size-20" />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <span className="font-mono text-xs text-muted-foreground">
                {item.code} · {PROPERTY_TYPE_LABELS[item.type]}
              </span>
              <ItemTitle className="line-clamp-2">{item.title}</ItemTitle>
              <ItemDescription className="truncate">{location(item)}</ItemDescription>
              <Prices item={item} />
            </ItemContent>
            <ItemFooter className="justify-start">
              <PropertyStatusBadge status={item.status} />
              <ImobScoreBadge score={item.imob_score} />
              {item.published_to_portals ? <Badge variant="outline">Nos portais</Badge> : null}
            </ItemFooter>
          </Item>
        ))}
      </ItemGroup>
    </>
  )
}
