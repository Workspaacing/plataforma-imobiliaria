// Recursos (features) por plano: chaves `feature_*` da pesquisa de preços (§5.3) e
// inclusão por plano conforme a tabela de benefícios (§3.3). Sem objetos
// Feature/Entitlements na Stripe na v1: o servidor deriva a lista daqui e grava
// em billing_accounts.features.
//
// Status:
// - "available": o módulo já existe no app, ou é serviço humano (ex.: migração assistida);
// - "soon": planejado. Aparece como "em breve" e não pode ser vendido como pronto
//   (oferta vincula, CDC art. 30). Onde a pesquisa diz "incluso" mas o módulo ainda
//   não existe no código (vários funis, domínio próprio, filiais, exportação e o
//   crédito automático de SLA), o status é "soon".

import type { BillingPlanKey, PlanKey } from "./plans"

export type FeatureStatus = "available" | "soon"

export const FEATURE_GROUPS = [
  "Imóveis e captação",
  "Clientes e vendas",
  "Marketing e portais",
  "Atendimento e WhatsApp",
  "Integrações",
  "Fechamento e gestão",
  "Locação e fiscal",
  "Equipe e conta",
  "Conformidade e suporte",
] as const

export type FeatureGroup = (typeof FEATURE_GROUPS)[number]

/** Ordem de exibição (agrupada por FEATURE_GROUPS). */
export const FEATURE_KEYS = [
  // Imóveis e captação
  "feature_properties",
  "feature_condominiums",
  "feature_listing_score",
  "feature_capture_public_form",
  "feature_keys",
  // Clientes e vendas
  "feature_clients",
  "feature_calendar_tasks",
  "feature_leads_kanban",
  "feature_multiple_pipelines",
  "feature_proposals",
  "feature_property_client_match",
  // Marketing e portais
  "feature_landing_pages",
  "feature_portal_feed_vrsync",
  "feature_portal_leads_ingest",
  "feature_meta_lead_ads",
  "feature_portal_health",
  "feature_portal_health_alerts",
  // Atendimento e WhatsApp
  "feature_ai_whatsapp",
  "feature_whatsapp_official_inbox",
  "feature_lead_roulette_sla",
  "feature_pwa_push",
  "feature_whatsapp_broadcast",
  // Integrações
  "feature_instagram_publish",
  "feature_instagram_inbox",
  "feature_document_inbox_email",
  "feature_maps",
  "feature_api_read",
  "feature_api_full",
  "feature_webhooks",
  // Fechamento e gestão
  "feature_esignature",
  "feature_bi_goals",
  "feature_launches",
  // Locação e fiscal
  "feature_rental_contracts",
  "feature_rental_billing_boleto_pix",
  "feature_rental_owner_payout",
  "feature_rental_adjustment",
  "feature_dimob",
  "feature_nfse",
  // Equipe e conta
  "feature_team_roles_invites",
  "feature_tenant_subdomain",
  "feature_custom_domain",
  "feature_multi_branch",
  "feature_data_export",
  "feature_assisted_migration",
  // Conformidade e suporte
  "feature_creci_compliance",
  "feature_lgpd_consent_audit",
  "feature_priority_support",
  "feature_success_manager",
  "feature_sla_credit",
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export type FeatureDefinition = {
  label: string
  description: string
  status: FeatureStatus
  group: FeatureGroup
  /** Planos que incluem o recurso (planHasFeature). */
  plans: readonly PlanKey[]
  /** Observação por plano para a tabela comparativa (ex.: "Até 2 pessoas", "Add-on"). */
  notes?: Partial<Record<PlanKey, string>>
}

// Listas locais (e não PLAN_KEYS) para não criar import circular em tempo de execução:
// plans.ts importa FEATURES.
const ALL: readonly PlanKey[] = ["corretor", "imobiliaria", "equipe", "rede"]
const FROM_IMOBILIARIA: readonly PlanKey[] = ["imobiliaria", "equipe", "rede"]
const FROM_EQUIPE: readonly PlanKey[] = ["equipe", "rede"]
const REDE_ONLY: readonly PlanKey[] = ["rede"]

export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  feature_properties: {
    label: "Imóveis ilimitados",
    description:
      "Cadastro de imóveis com fotos, características e status, sem limite de quantidade.",
    status: "available",
    group: "Imóveis e captação",
    plans: ALL,
  },
  feature_condominiums: {
    label: "Condomínios",
    description: "Cadastro de condomínios e empreendimentos ligado aos imóveis, sem limite.",
    status: "available",
    group: "Imóveis e captação",
    plans: ALL,
  },
  feature_listing_score: {
    label: "Nota do Anúncio",
    description: "Avalia a qualidade de cada anúncio e aponta o que melhorar antes de publicar.",
    status: "available",
    group: "Imóveis e captação",
    plans: ALL,
  },
  feature_capture_public_form: {
    label: "Captação com formulário público",
    description:
      "Link para proprietários oferecerem imóveis, com as solicitações numa caixa de entrada.",
    status: "available",
    group: "Imóveis e captação",
    plans: ALL,
  },
  feature_keys: {
    label: "Controle de chaves",
    description: "Registro de retirada e devolução das chaves de cada imóvel.",
    status: "available",
    group: "Imóveis e captação",
    plans: ALL,
  },
  feature_clients: {
    label: "Clientes ilimitados",
    description: "Cadastro de clientes com contatos, interesses e histórico de atendimento.",
    status: "available",
    group: "Clientes e vendas",
    plans: ALL,
  },
  feature_calendar_tasks: {
    label: "Agenda e tarefas",
    description: "Visitas, compromissos e tarefas da equipe organizados num só lugar.",
    status: "available",
    group: "Clientes e vendas",
    plans: ALL,
  },
  feature_leads_kanban: {
    label: "Funil de leads em kanban",
    description: "Leads organizados por etapa, do primeiro contato ao fechamento.",
    status: "available",
    group: "Clientes e vendas",
    plans: ALL,
  },
  feature_multiple_pipelines: {
    label: "Vários funis de leads",
    description: "Funis separados por finalidade, como venda, locação ou lançamento.",
    status: "soon",
    group: "Clientes e vendas",
    plans: FROM_IMOBILIARIA,
  },
  feature_proposals: {
    label: "Propostas",
    description: "Registro de propostas por imóvel e cliente, com valores e andamento.",
    status: "available",
    group: "Clientes e vendas",
    plans: ALL,
  },
  feature_property_client_match: {
    label: "Match imóvel × cliente",
    description: "Sugere os imóveis que combinam com o perfil de cada cliente, e vice-versa.",
    status: "available",
    group: "Clientes e vendas",
    plans: ALL,
  },
  feature_landing_pages: {
    label: "Landing pages",
    description: "Páginas de captação prontas, com o lead entrando direto no funil.",
    status: "available",
    group: "Marketing e portais",
    plans: ALL,
  },
  feature_portal_feed_vrsync: {
    label: "Feed XML para portais",
    description: "Publica os imóveis no ZAP, Viva Real e OLX pelo padrão VRSync.",
    status: "available",
    group: "Marketing e portais",
    plans: ALL,
  },
  feature_portal_leads_ingest: {
    label: "Leads dos portais",
    description: "Contatos recebidos nos portais entram automaticamente no funil.",
    status: "soon",
    group: "Marketing e portais",
    plans: ALL,
  },
  feature_meta_lead_ads: {
    label: "Meta Lead Ads",
    description: "Leads dos formulários de anúncio do Facebook e do Instagram direto no funil.",
    status: "soon",
    group: "Marketing e portais",
    plans: ALL,
  },
  feature_portal_health: {
    label: "Saúde dos portais",
    description: "Painel com a situação dos anúncios e dos leads recebidos em cada portal.",
    status: "soon",
    group: "Marketing e portais",
    plans: ALL,
    notes: { corretor: "Painel" },
  },
  feature_portal_health_alerts: {
    label: "Alarme de lead ausente",
    description: "Avisa quando um portal para de enviar leads como de costume.",
    status: "soon",
    group: "Marketing e portais",
    plans: FROM_IMOBILIARIA,
  },
  feature_ai_whatsapp: {
    label: "Agente de IA no WhatsApp",
    description:
      "Responde o lead no WhatsApp oficial em segundos, 24 horas por dia, e chama um corretor quando precisa.",
    status: "soon",
    group: "Atendimento e WhatsApp",
    plans: ALL,
  },
  feature_whatsapp_official_inbox: {
    label: "Caixa de WhatsApp da empresa",
    description: "Vários atendentes no mesmo número, com o histórico sempre na imobiliária.",
    status: "soon",
    group: "Atendimento e WhatsApp",
    plans: ALL,
  },
  feature_lead_roulette_sla: {
    label: "Roleta de leads com SLA",
    description:
      "Distribui os leads entre os corretores e redistribui quando ninguém responde no prazo.",
    status: "soon",
    group: "Atendimento e WhatsApp",
    plans: FROM_IMOBILIARIA,
  },
  feature_pwa_push: {
    label: "Aviso de lead novo no celular",
    description: "App instalável com notificação assim que o lead chega.",
    status: "soon",
    group: "Atendimento e WhatsApp",
    plans: ALL,
  },
  feature_whatsapp_broadcast: {
    label: "WhatsApp Divulgação",
    description:
      "Disparo por modelo aprovado, com créditos pré-pagos e tarifa visível antes de enviar.",
    status: "soon",
    group: "Atendimento e WhatsApp",
    plans: ALL,
    notes: {
      corretor: "Créditos pré-pagos",
      imobiliaria: "Créditos pré-pagos",
      equipe: "Créditos pré-pagos",
      rede: "Créditos pré-pagos",
    },
  },
  feature_instagram_publish: {
    label: "Publicação no Instagram",
    description: "Publique imóveis no Instagram direto do cadastro.",
    status: "soon",
    group: "Integrações",
    plans: ALL,
  },
  feature_instagram_inbox: {
    label: "Mensagens do Instagram",
    description: "Responda as mensagens do Instagram junto com os demais atendimentos.",
    status: "soon",
    group: "Integrações",
    plans: FROM_IMOBILIARIA,
  },
  feature_document_inbox_email: {
    label: "Caixa de documentos por e-mail",
    description: "Documentos enviados por e-mail chegam anexados ao cadastro certo.",
    status: "soon",
    group: "Integrações",
    plans: ALL,
  },
  feature_maps: {
    label: "Mapas",
    description: "Imóveis e buscas visualizados no mapa.",
    status: "soon",
    group: "Integrações",
    plans: ALL,
  },
  feature_api_read: {
    label: "API de leitura",
    description: "Consulte imóveis, clientes e leads por API para integrar outros sistemas.",
    status: "soon",
    group: "Integrações",
    plans: FROM_EQUIPE,
  },
  feature_api_full: {
    label: "API completa",
    description: "Leia e grave dados por API para automatizar a operação.",
    status: "soon",
    group: "Integrações",
    plans: REDE_ONLY,
  },
  feature_webhooks: {
    label: "Webhooks",
    description: "Avisos automáticos para outros sistemas quando algo muda no CRM.",
    status: "soon",
    group: "Integrações",
    plans: REDE_ONLY,
  },
  feature_esignature: {
    label: "Assinatura eletrônica",
    description: "Envie contratos e propostas para assinatura eletrônica sem sair do CRM.",
    status: "soon",
    group: "Fechamento e gestão",
    plans: ALL,
  },
  feature_bi_goals: {
    label: "BI e metas por corretor",
    description: "Indicadores de atendimento e vendas, com metas individuais e da equipe.",
    status: "soon",
    group: "Fechamento e gestão",
    plans: FROM_EQUIPE,
  },
  feature_launches: {
    label: "Lançamentos",
    description: "Espelho de vendas para empreendimentos na planta.",
    status: "soon",
    group: "Fechamento e gestão",
    plans: REDE_ONLY,
    notes: { imobiliaria: "Add-on", equipe: "Add-on" },
  },
  feature_rental_contracts: {
    label: "Contratos de locação",
    description: "Gestão dos contratos de aluguel, com prazos, garantias e renovações.",
    status: "soon",
    group: "Locação e fiscal",
    plans: FROM_IMOBILIARIA,
    notes: { corretor: "Add-on" },
  },
  feature_rental_billing_boleto_pix: {
    label: "Cobrança do aluguel por boleto e Pix",
    description: "Gera a cobrança mensal do inquilino e dá baixa automática no pagamento.",
    status: "soon",
    group: "Locação e fiscal",
    plans: FROM_IMOBILIARIA,
    notes: { corretor: "Add-on" },
  },
  feature_rental_owner_payout: {
    label: "Repasse ao proprietário",
    description: "Calcula e registra o repasse de cada aluguel, com demonstrativo.",
    status: "soon",
    group: "Locação e fiscal",
    plans: FROM_IMOBILIARIA,
    notes: { corretor: "Add-on" },
  },
  feature_rental_adjustment: {
    label: "Reajuste de aluguel",
    description: "Aplica o índice do contrato na data certa e avisa as partes.",
    status: "soon",
    group: "Locação e fiscal",
    plans: FROM_IMOBILIARIA,
    notes: { corretor: "Add-on" },
  },
  feature_dimob: {
    label: "DIMOB",
    description: "Gera a declaração anual de atividades imobiliárias para a Receita Federal.",
    status: "soon",
    group: "Locação e fiscal",
    plans: FROM_IMOBILIARIA,
    notes: { corretor: "Add-on" },
  },
  feature_nfse: {
    label: "NFS-e da taxa de administração",
    description: "Emite a nota fiscal de serviço da taxa de administração da locação.",
    status: "soon",
    group: "Locação e fiscal",
    plans: FROM_IMOBILIARIA,
    notes: {
      corretor: "Com locação",
      imobiliaria: "Com locação",
      equipe: "Com locação",
      rede: "Com locação",
    },
  },
  feature_team_roles_invites: {
    label: "Equipe com papéis e convites",
    description: "Convide a equipe e defina o que cada papel pode ver e fazer.",
    status: "available",
    group: "Equipe e conta",
    plans: ALL,
    notes: { corretor: "Até 2 pessoas" },
  },
  feature_tenant_subdomain: {
    label: "Subdomínio próprio",
    description: "Endereço exclusivo da imobiliária para o CRM e as páginas públicas.",
    status: "available",
    group: "Equipe e conta",
    plans: ALL,
  },
  feature_custom_domain: {
    label: "Domínio próprio",
    description: "Conecte o domínio que já é seu, com SSL, sem custo extra.",
    status: "soon",
    group: "Equipe e conta",
    plans: ALL,
  },
  feature_multi_branch: {
    label: "Multi-imobiliária e filiais",
    description: "Várias lojas ou marcas numa só conta, cada uma com seu subdomínio.",
    status: "soon",
    group: "Equipe e conta",
    plans: REDE_ONLY,
    notes: { rede: "Até 5" },
  },
  feature_data_export: {
    label: "Exportação completa",
    description: "Baixe imóveis, clientes, leads e fotos quando quiser, sem pedir ao suporte.",
    status: "soon",
    group: "Equipe e conta",
    plans: ALL,
  },
  feature_assisted_migration: {
    label: "Migração assistida grátis",
    description: "Ajudamos a trazer os dados do sistema atual, sem custo.",
    status: "available",
    group: "Equipe e conta",
    plans: ALL,
    notes: { equipe: "Com validação lado a lado", rede: "Com validação lado a lado" },
  },
  feature_creci_compliance: {
    label: "CRECI com validade",
    description: "Guarda o CRECI de cada corretor e avisa antes do vencimento.",
    status: "soon",
    group: "Conformidade e suporte",
    plans: ALL,
  },
  feature_lgpd_consent_audit: {
    label: "LGPD: consentimento e registro de acesso",
    description: "Registra o consentimento dos leads e quem acessou cada dado pessoal.",
    status: "soon",
    group: "Conformidade e suporte",
    plans: ALL,
  },
  feature_priority_support: {
    label: "Suporte prioritário",
    description: "Atendimento humano com resposta mais rápida e onboarding ao vivo.",
    status: "available",
    group: "Conformidade e suporte",
    plans: FROM_EQUIPE,
  },
  feature_success_manager: {
    label: "Gerente de sucesso",
    description: "Uma pessoa dedicada a acompanhar a implantação e os resultados da conta.",
    status: "available",
    group: "Conformidade e suporte",
    plans: REDE_ONLY,
  },
  feature_sla_credit: {
    label: "SLA de 99,9% com crédito",
    description: "Disponibilidade garantida, com crédito na fatura quando não for cumprida.",
    status: "soon",
    group: "Conformidade e suporte",
    plans: REDE_ONLY,
  },
}

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && Object.hasOwn(FEATURES, value)
}

/** O teste grátis tem os recursos do plano Equipe. Plano ou recurso desconhecido → false. */
export function planHasFeature(plan: BillingPlanKey, feature: FeatureKey): boolean {
  const definition: FeatureDefinition | undefined = isFeatureKey(feature)
    ? FEATURES[feature]
    : undefined

  if (!definition) {
    return false
  }

  const effectivePlan = plan === "trial" ? "equipe" : plan
  return definition.plans.includes(effectivePlan)
}

/** Recursos do plano na ordem de FEATURE_KEYS (o teste grátis herda os do Equipe). */
export function featuresForPlan(plan: BillingPlanKey): FeatureKey[] {
  return FEATURE_KEYS.filter((feature) => planHasFeature(plan, feature))
}
