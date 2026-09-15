import {
  CreditCardIcon,
  GlobeIcon,
  PlugIcon,
  StoreIcon,
  UserCogIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { NAV_GROUPS } from "@/components/crm/nav-config"
import { ORGANIZATION_VIEWER_ROLES, TEAM_MANAGER_ROLES, type Role } from "@/lib/auth/roles"
import { SUBSCRIPTION_SETTINGS_PATH } from "@/lib/auth/routes"

/** Índice de configurações (estilo Stripe). */
export const SETTINGS_INDEX_PATH = "/configuracoes"

export const ORGANIZATION_SETTINGS_PATH = "/configuracoes/imobiliaria"
export const TEAM_SETTINGS_PATH = "/configuracoes/equipe"
/** O perfil ainda não mudou para /configuracoes/perfil (depende do agente de autenticação). */
export const PROFILE_SETTINGS_PATH = "/perfil"

export type SettingsItem = {
  /** Título no índice. */
  title: string
  /** Rótulo curto na sub-navegação; sem valor, o item não aparece nela. */
  navTitle?: string
  description: string
  icon: LucideIcon
  /** Sem `href`: item previsto no plano, mostrado como "Em breve". */
  href?: string
  /** Papéis que veem o item. Sem valor: todos. A página também valida no servidor. */
  roles?: readonly Role[]
}

export type SettingsSection = {
  title: string
  items: SettingsItem[]
}

/**
 * Papéis do item igual ao da sidebar (nav-config), para que índice, sub-navegação e
 * menu lateral nunca divirjam. O fallback só vale se o item sair da sidebar.
 */
function sidebarRoles(url: string, fallback: readonly Role[]) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => candidate.url === url)

    if (item) {
      return item.roles
    }
  }

  return fallback
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: "Minha conta",
    items: [
      {
        title: "Perfil",
        navTitle: "Perfil",
        description: "Nome, foto, telefone, CRECI e senha de acesso.",
        icon: UserRoundIcon,
        href: PROFILE_SETTINGS_PATH,
      },
    ],
  },
  {
    title: "Imobiliária",
    items: [
      {
        title: "Dados e marca",
        navTitle: "Imobiliária",
        description: "Nome, CNPJ, CRECI, logo e cor usados no CRM e na captação.",
        icon: StoreIcon,
        href: ORGANIZATION_SETTINGS_PATH,
        roles: sidebarRoles(ORGANIZATION_SETTINGS_PATH, ORGANIZATION_VIEWER_ROLES),
      },
      {
        title: "Equipe",
        navTitle: "Equipe",
        description: "Convites, papéis e CRECI de quem tem acesso.",
        icon: UserCogIcon,
        href: TEAM_SETTINGS_PATH,
        roles: sidebarRoles(TEAM_SETTINGS_PATH, TEAM_MANAGER_ROLES),
      },
      {
        title: "Assinatura",
        navTitle: "Assinatura",
        description: "Plano, uso, forma de pagamento e faturas.",
        icon: CreditCardIcon,
        href: SUBSCRIPTION_SETTINGS_PATH,
        roles: sidebarRoles(SUBSCRIPTION_SETTINGS_PATH, ORGANIZATION_VIEWER_ROLES),
      },
      {
        title: "Portais",
        description: "Feed de anúncios para ZAP Imóveis, Viva Real e OLX.",
        icon: GlobeIcon,
        // A integração por feed já existe na página da imobiliária.
        href: `${ORGANIZATION_SETTINGS_PATH}#portais`,
        roles: sidebarRoles(ORGANIZATION_SETTINGS_PATH, ORGANIZATION_VIEWER_ROLES),
      },
      {
        title: "Integrações",
        description: "WhatsApp, Meta e e-mail conectados ao CRM.",
        icon: PlugIcon,
        roles: TEAM_MANAGER_ROLES,
      },
    ],
  },
]

function canSee(item: SettingsItem, role: Role) {
  return !item.roles || item.roles.includes(role)
}

/** Seções do índice visíveis para o papel (seções vazias somem). */
export function getSettingsSectionsForRole(role: Role) {
  return SETTINGS_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canSee(item, role)),
  })).filter((section) => section.items.length > 0)
}

export type SettingsNavGroup = {
  title: string
  items: { title: string; href: string; icon: LucideIcon }[]
}

/**
 * Sub-navegação vertical: Imobiliária, Equipe, Assinatura e Perfil, na ordem da
 * imobiliária primeiro (é onde o gestor passa mais tempo).
 */
export function getSettingsNavForRole(role: Role): SettingsNavGroup[] {
  const groups: SettingsNavGroup[] = [...SETTINGS_SECTIONS].reverse().map((section) => ({
    title: section.title,
    items: section.items
      .filter((item) => item.navTitle && item.href && canSee(item, role))
      .map((item) => ({
        title: item.navTitle as string,
        href: item.href as string,
        icon: item.icon,
      })),
  }))

  return groups.filter((group) => group.items.length > 0)
}
