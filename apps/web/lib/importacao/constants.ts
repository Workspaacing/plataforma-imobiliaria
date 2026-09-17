import type { ImportKind } from "@workspace/core/import/fields"

import { TEAM_MANAGER_ROLES, type Role } from "@/lib/auth/roles"

/** Importação de planilhas (clientes, leads e imóveis). */
export const IMPORT_SETTINGS_PATH = "/configuracoes/importacao"

/** Só dono e gerente importam (a RPC confere de novo no banco). */
export const IMPORT_ROLES: readonly Role[] = TEAM_MANAGER_ROLES

/** Listas que mudam depois de uma importação. */
export const IMPORT_LIST_PATHS: Record<ImportKind, string> = {
  clients: "/clientes",
  leads: "/leads",
  properties: "/imoveis",
}

export const IMPORT_ACCEPT =
  ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** Base legal (LGPD) aplicada aos contatos importados. */
export const IMPORT_LEGAL_BASIS_VALUES = ["legitimate_interest", "contract"] as const

export type ImportLegalBasis = (typeof IMPORT_LEGAL_BASIS_VALUES)[number]

export const IMPORT_LEGAL_BASIS_LABELS: Record<ImportLegalBasis, { title: string; hint: string }> =
  {
    legitimate_interest: {
      title: "Legítimo interesse",
      hint: "Contatos que procuraram a imobiliária ou já são atendidos por ela.",
    },
    contract: {
      title: "Execução de contrato ou pré-contrato",
      hint: "Proprietários, inquilinos e compradores com negócio em andamento.",
    },
  }

export const IMPORT_DEFAULT_TAG = "Importado"
