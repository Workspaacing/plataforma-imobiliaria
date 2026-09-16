import {
  BuildingIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  GiftIcon,
  HandshakeIcon,
  HouseIcon,
  HousePlusIcon,
  KanbanIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  ListTodoIcon,
  SettingsIcon,
  StoreIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { ORGANIZATION_VIEWER_ROLES, TEAM_MANAGER_ROLES, type Role } from "@/lib/auth/roles"

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  /** Papéis que veem o item. Sem valor: todos. A página também valida no servidor. */
  roles?: readonly Role[]
  /** Rotas extras que também marcam o item como ativo (ex.: /perfil para Configurações). */
  extraActivePaths?: readonly string[]
}

export type NavGroup = {
  title: string
  /** Rota do índice do grupo (ex.: Configurações); com valor, o rótulo do grupo vira link. */
  url?: string
  items: NavItem[]
  /**
   * Grupo fora da sidebar (getNavGroupsForRole o remove), mas ainda usado pelo
   * findNavMatch para o breadcrumb e pelo sidebarRoles do settings-config.
   */
  hidden?: boolean
}

export type NavMatch = {
  group: NavGroup
  item: { title: string; url: string }
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Principal",
    items: [{ title: "Painel", url: "/painel", icon: LayoutDashboardIcon }],
  },
  {
    title: "Funil",
    items: [{ title: "Leads", url: "/leads", icon: KanbanIcon }],
  },
  {
    title: "Imóveis",
    items: [
      { title: "Imóveis", url: "/imoveis", icon: HouseIcon },
      { title: "Condomínios", url: "/condominios", icon: BuildingIcon },
      { title: "Chaves", url: "/chaves", icon: KeyRoundIcon },
      { title: "Propostas", url: "/propostas", icon: HandshakeIcon },
      {
        title: "Captações",
        url: "/captacao",
        icon: HousePlusIcon,
        roles: ["owner", "manager", "capturer", "assistant"],
      },
    ],
  },
  {
    title: "Clientes",
    items: [
      { title: "Clientes", url: "/clientes", icon: UsersIcon },
      { title: "Agenda", url: "/agenda", icon: CalendarDaysIcon },
      { title: "Tarefas", url: "/tarefas", icon: ListTodoIcon },
    ],
  },
  {
    title: "Marketing",
    items: [
      {
        title: "Landing pages",
        url: "/marketing/landing-pages",
        icon: LayoutTemplateIcon,
        roles: ["owner", "manager", "assistant"],
      },
    ],
  },
  {
    // Fora da sidebar (ver NavGroup.hidden): o item único de Configurações abaixo já
    // leva ao índice. Os itens seguem aqui só para o findNavMatch (breadcrumb) e para o
    // sidebarRoles do settings-config, que leem os papéis de cada rota a partir daqui.
    title: "Configurações",
    url: "/configuracoes",
    hidden: true,
    items: [
      {
        title: "Equipe",
        url: "/configuracoes/equipe",
        icon: UserCogIcon,
        roles: TEAM_MANAGER_ROLES,
      },
      {
        title: "Imobiliária",
        url: "/configuracoes/imobiliaria",
        icon: StoreIcon,
        roles: ORGANIZATION_VIEWER_ROLES,
      },
      {
        title: "Assinatura",
        url: "/configuracoes/assinatura",
        icon: CreditCardIcon,
        roles: ORGANIZATION_VIEWER_ROLES,
      },
      {
        title: "Indicações",
        url: "/configuracoes/indicacoes",
        icon: GiftIcon,
        roles: ORGANIZATION_VIEWER_ROLES,
      },
    ],
  },
  {
    // Sem título: um único item "Configurações", sem grupo duplicando o índice.
    title: "",
    items: [
      {
        title: "Configurações",
        url: "/configuracoes",
        icon: SettingsIcon,
        extraActivePaths: ["/perfil"],
      },
    ],
  },
]

/** Títulos de rotas que não estão no menu lateral. */
export const EXTRA_PAGE_TITLES: Record<string, string> = {
  "/perfil": "Meu perfil",
}

export function getNavGroupsForRole(role: Role) {
  return NAV_GROUPS.filter((group) => !group.hidden)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0 || group.url)
}

export function isNavItemActive(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`)
}

/** Ativo em `item.url` e, quando houver, em qualquer rota de `item.extraActivePaths`. */
export function isNavItemActiveWithExtras(pathname: string, item: NavItem) {
  return (
    isNavItemActive(pathname, item.url) ||
    (item.extraActivePaths?.some((url) => isNavItemActive(pathname, url)) ?? false)
  )
}

export function findNavMatch(pathname: string): NavMatch | null {
  let match: NavMatch | null = null

  for (const group of NAV_GROUPS) {
    if (
      group.url &&
      isNavItemActive(pathname, group.url) &&
      (!match || group.url.length > match.item.url.length)
    ) {
      match = { group, item: { title: group.title, url: group.url } }
    }

    for (const item of group.items) {
      if (
        isNavItemActive(pathname, item.url) &&
        (!match || item.url.length > match.item.url.length)
      ) {
        match = { group, item }
      }
    }
  }

  return match
}
