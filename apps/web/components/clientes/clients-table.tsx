import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { formatDate } from "@/lib/format"
import { CLIENTS_PATH, getClientSourceLabel } from "@/lib/clientes/constants"
import { formatPhone, maskClientDocument } from "@/lib/clientes/format"
import { getMemberName, type MemberOption } from "@/lib/clientes/options"
import type { ClientListRow } from "@/lib/clientes/queries"

const MAX_VISIBLE_TAGS = 3

type ClientsTableProps = {
  rows: ClientListRow[]
  members: MemberOption[]
}

export function ClientsTable({ rows, members }: ClientsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Etiquetas</TableHead>
            <TableHead className="text-end">Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((client) => {
            const phone = client.phone ?? client.whatsapp
            const hiddenTags = client.tags.length - MAX_VISIBLE_TAGS

            return (
              <TableRow key={client.id}>
                <TableCell className="max-w-64">
                  <div className="flex min-w-0 flex-col">
                    <Link
                      href={`${CLIENTS_PATH}/${client.id}`}
                      className="truncate font-medium underline-offset-4 hover:underline"
                    >
                      {client.name}
                    </Link>
                    {client.kind === "pj" && client.trade_name ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {client.trade_name}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{client.kind === "pf" ? "PF" : "PJ"}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {maskClientDocument(client.kind, client.document)}
                </TableCell>
                <TableCell className="max-w-56">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{client.email ?? "—"}</span>
                    {phone ? (
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        {formatPhone(phone)}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {client.assigned_to ? (
                    getMemberName(members, client.assigned_to)
                  ) : (
                    <span className="text-muted-foreground">Sem responsável</span>
                  )}
                </TableCell>
                <TableCell>{getClientSourceLabel(client.source)}</TableCell>
                <TableCell>
                  {client.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {client.tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                      {hiddenTags > 0 ? <Badge variant="outline">+{hiddenTags}</Badge> : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-end tabular-nums">{formatDate(client.created_at)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
