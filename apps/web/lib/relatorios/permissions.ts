import type { Role } from "@/lib/auth/roles"

/**
 * Espelho, para a interface, do recorte que o banco já aplica em
 * `private.report_broker_filter` (migração `relatorios_desempenho`).
 *
 * - **dono e gerente**: veem o desempenho de toda a equipe e escolhem o
 *   corretor no filtro;
 * - **qualquer outro papel**: vê só o próprio desempenho. Mandar o id de um
 *   colega na URL não muda nada — a RPC troca o parâmetro pelo usuário da
 *   sessão antes de somar qualquer coisa.
 *
 * A garantia continua sendo o banco; isto aqui só decide o que desenhar e qual
 * aviso mostrar na tela. Por isso a tela DIZ o recorte em que está, em vez de
 * deixar o corretor achar que o número da imobiliária inteira é o dele.
 */
export const REPORT_TEAM_ROLES: readonly Role[] = ["owner", "manager"]

/** Vê a equipe inteira e pode filtrar por corretor. */
export function canSeeTeamReports(role: Role) {
  return REPORT_TEAM_ROLES.includes(role)
}

/**
 * Colunas sensíveis da exportação (CPF/CNPJ e data de nascimento do cliente,
 * ids de clique do lead): mesmos papéis de `canSeeLeadTrackingIds`. Quem não
 * pode ver recebe a coluna vazia — a RPC devolve null, isto aqui só evita
 * prometer na tela o que o arquivo não vai trazer.
 */
export function canExportSensitiveColumns(role: Role) {
  return REPORT_TEAM_ROLES.includes(role)
}

/** Texto do aviso de recorte, no topo da tela. */
export function reportScopeNotice(role: Role, memberName: string | null) {
  if (canSeeTeamReports(role)) {
    return "Você vê o desempenho de toda a equipe e pode comparar os corretores da imobiliária."
  }

  return memberName
    ? `Você vê apenas o seu desempenho (${memberName}). Só o dono e o gerente veem o número dos colegas.`
    : "Você vê apenas o seu desempenho. Só o dono e o gerente veem o número dos colegas."
}
