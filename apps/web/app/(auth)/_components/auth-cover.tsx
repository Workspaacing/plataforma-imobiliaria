import {
  CalendarDaysIcon,
  HandshakeIcon,
  HistoryIcon,
  KanbanIcon,
  KeyRoundIcon,
  LayoutTemplateIcon,
  LockKeyholeIcon,
  MapPinIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { Separator } from "@workspace/ui/components/separator"

type Feature = {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: KanbanIcon,
    title: "Funil de leads",
    description: "Contatos dos portais e das landing pages chegam direto no funil.",
  },
  {
    icon: KeyRoundIcon,
    title: "Imóveis e chaves",
    description: "Cadastro com fotos, condomínios, captações e controle de chaves.",
  },
  {
    icon: UsersIcon,
    title: "Clientes",
    description: "Histórico, documentos e interesses de cada cliente.",
  },
  {
    icon: CalendarDaysIcon,
    title: "Agenda e tarefas",
    description: "Visitas e retornos organizados para toda a equipe.",
  },
  {
    icon: HandshakeIcon,
    title: "Propostas",
    description: "Da negociação à proposta aceita, tudo registrado.",
  },
  {
    icon: LayoutTemplateIcon,
    title: "Landing pages",
    description: "Páginas prontas para captar leads, sem programar.",
  },
]

const HIGHLIGHTS: { icon: LucideIcon; label: string }[] = [
  { icon: MapPinIcon, label: "Dados hospedados no Brasil" },
  { icon: LockKeyholeIcon, label: "Acesso por papel na equipe" },
  { icon: HistoryIcon, label: "Histórico de acessos" },
]

/** Painel lateral das telas de autenticação: o que o workspace do CRM oferece. */
export function AuthCover() {
  return (
    <aside className="hidden flex-col justify-between gap-10 border-s bg-muted/40 p-10 lg:flex xl:p-14">
      <div className="flex max-w-lg flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Workspace da imobiliária</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance">
          Imóveis, clientes e equipe num só lugar.
        </h2>
        <p className="text-pretty text-muted-foreground">
          Do primeiro contato ao contrato assinado, cada corretor sabe o que precisa fazer hoje.
        </p>
      </div>

      <ul className="grid max-w-2xl gap-x-8 gap-y-6 xl:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-foreground/10">
              <Icon aria-hidden="true" className="size-4 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-4">
        <Separator />
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
