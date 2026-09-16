import { ROLES, type Role } from "@/lib/auth/roles"

/**
 * O que cada papel pode fazer, em uma frase por área, para a tela de Equipe.
 *
 * É a versão legível das mesmas regras dos arquivos `permissions.ts` de cada módulo (que por sua
 * vez espelham o RLS). Ao mexer em uma política do banco, ajuste aqui também:
 * uma pessoa que lê "não exclui" e consegue excluir perde a confiança na tela.
 */

export type RolePermissionArea = {
  /** Identificador estável (chave de lista). */
  id: string
  title: string
  byRole: Record<Role, string>
}

export const ROLE_PERMISSION_AREAS: RolePermissionArea[] = [
  {
    id: "imoveis",
    title: "Imóveis",
    byRole: {
      owner: "Vê, cadastra, edita e publica qualquer imóvel. Exclui imóveis e fotos.",
      manager: "Vê, cadastra, edita e publica qualquer imóvel. Exclui imóveis e fotos.",
      broker:
        "Vê todos; cadastra e edita os imóveis em que é corretor ou captador. Não exclui imóveis nem fotos.",
      capturer: "Vê todos; cadastra e edita os imóveis que captou. Não exclui imóveis nem fotos.",
      assistant:
        "Vê, cadastra, edita e publica qualquer imóvel, inclusive fotos e proprietários. Não exclui nada.",
      finance: "Só leitura: vê os imóveis, sem cadastrar nem editar.",
    },
  },
  {
    id: "clientes",
    title: "Clientes e documentos",
    byRole: {
      owner: "Vê, cadastra, edita e exclui qualquer cliente, documento e compartilhamento.",
      manager: "Vê, cadastra, edita e exclui qualquer cliente, documento e compartilhamento.",
      broker:
        "Cadastra clientes e trabalha os que são dele (responsável ou compartilhados com ele). Não exclui.",
      capturer:
        "Cadastra clientes e trabalha os que cadastrou ou que são proprietários de algum imóvel. Não exclui.",
      assistant: "Vê, cadastra e edita qualquer cliente e anexa documentos. Não exclui.",
      finance: "Só leitura das fichas e dos documentos.",
    },
  },
  {
    id: "leads",
    title: "Leads e propostas",
    byRole: {
      owner: "Vê e trabalha todos os leads e propostas. Exclui leads.",
      manager: "Vê e trabalha todos os leads e propostas. Exclui leads.",
      broker: "Vê os leads dele e os sem responsável (pode assumir). Cria propostas como corretor.",
      capturer: "Só leitura dos leads atribuídos a ele. Cria propostas como corretor.",
      assistant: "Vê, cadastra e trabalha todos os leads. Não exclui.",
      finance: "Só leitura dos leads atribuídos a ele.",
    },
  },
  {
    id: "agenda",
    title: "Agenda, tarefas e chaves",
    byRole: {
      owner: "Vê a agenda de todos, agenda para qualquer corretor e apaga visitas.",
      manager: "Vê a agenda de todos, agenda para qualquer corretor e apaga visitas.",
      broker: "Agenda para si, edita as próprias visitas e registra retirada de chaves.",
      capturer: "Agenda para si, edita as próprias visitas e registra retirada de chaves.",
      assistant: "Vê a agenda de todos, agenda para qualquer corretor e cuida das chaves.",
      finance: "Só leitura da agenda. Cria e conclui as próprias tarefas.",
    },
  },
  {
    id: "marketing",
    title: "Marketing e portais",
    byRole: {
      owner: "Cria, edita e publica landing pages. Configura os portais e o feed.",
      manager: "Cria, edita e publica landing pages. Vê a configuração dos portais.",
      broker: "Só visualiza as landing pages.",
      capturer: "Só visualiza as landing pages.",
      assistant: "Cria, edita e publica landing pages.",
      finance: "Só visualiza as landing pages.",
    },
  },
  {
    id: "equipe",
    title: "Equipe e dados da imobiliária",
    byRole: {
      owner:
        "Edita os dados e a marca da imobiliária, convida qualquer papel e cuida da assinatura.",
      manager:
        "Convida e gerencia corretores, captadores e assistentes. Vê os dados da imobiliária.",
      broker: "Não acessa a equipe nem os dados da imobiliária.",
      capturer: "Não acessa a equipe nem os dados da imobiliária.",
      assistant: "Não acessa a equipe nem os dados da imobiliária.",
      finance: "Vê os dados da imobiliária e a assinatura, sem editar a equipe.",
    },
  },
  {
    id: "historico",
    title: "Histórico de alterações",
    byRole: {
      owner: "Vê o histórico (quem mudou o quê e quando) do imóvel e do cliente.",
      manager: "Vê o histórico (quem mudou o quê e quando) do imóvel e do cliente.",
      broker: "Não vê o histórico de alterações.",
      capturer: "Não vê o histórico de alterações.",
      assistant: "Não vê o histórico de alterações.",
      finance: "Não vê o histórico de alterações.",
    },
  },
]

/** Uma linha por área para o papel escolhido. */
export function getRolePermissions(role: Role) {
  return ROLE_PERMISSION_AREAS.map((area) => ({
    id: area.id,
    title: area.title,
    text: area.byRole[role],
  }))
}

export const ROLE_PERMISSION_ROLES: readonly Role[] = ROLES
