/**
 * Console da Plataforma — segredos esperados no Vault do Supabase.
 *
 * Só a EXISTÊNCIA de cada segredo, pelo nome (`platform_health` nunca lê o
 * valor). As chaves do servidor são criadas pelas próprias migrações; faltar
 * uma quer dizer migração não aplicada. Os webhooks das filas são cadastrados à
 * mão e fazem os avisos saírem em minutos, apesar do cron diário da Vercel.
 */

import type { HealthItem, HealthStatus } from "./health"

export type ExpectedServerKeySecret = {
  name: string
  env: string
  label: string
}

/** Segredos `*_server_key` criados pelas migrações (um por grupo de RPCs sem sessão). */
export const EXPECTED_SERVER_KEY_SECRETS: readonly ExpectedServerKeySecret[] = [
  { name: "platform_server_key", env: "PLATFORM_SERVER_KEY", label: "Console da Plataforma" },
  { name: "notification_server_key", env: "NOTIFICATION_SERVER_KEY", label: "Filas de avisos" },
  { name: "lead_server_key", env: "LEAD_SERVER_KEY", label: "Leads das páginas públicas" },
  { name: "capture_server_key", env: "CAPTURE_SERVER_KEY", label: "Formulário de captação" },
  { name: "billing_server_key", env: "BILLING_SERVER_KEY", label: "Assinaturas" },
  { name: "caixa_server_key", env: "CAIXA_SERVER_KEY", label: "Catálogo da Caixa" },
  {
    name: "lead_ingest_server_key",
    env: "LEAD_INGEST_SERVER_KEY",
    label: "Entrada de leads de portais e anúncios",
  },
  {
    name: "connections_server_key",
    env: "CONNECTIONS_SERVER_KEY",
    label: "Contas conectadas e WhatsApp",
  },
]

export type ExpectedWebhookSecretPair = {
  key: string
  label: string
  url: string
  secret: string
  /** Rota do Next que o banco chama (POST com Authorization: Bearer CRON_SECRET). */
  route: string
  /** Estado quando os dois faltam. */
  missingStatus: HealthStatus
  /** Consequência da falta, em pt-BR. */
  missing: string
}

/** Pares de segredos dos webhooks chamados pelo pg_cron (pg_net). */
export const EXPECTED_WEBHOOK_SECRET_PAIRS: readonly ExpectedWebhookSecretPair[] = [
  {
    key: "lead_alerts",
    label: "Webhook dos avisos de lead",
    url: "lead_alerts_webhook_url",
    secret: "lead_alerts_webhook_secret",
    route: "/api/cron/lead-alerts",
    missingStatus: "atencao",
    missing:
      "Os avisos de lead (lead novo, prazo acabando) só saem na rotina diária da Vercel, e não em minutos.",
  },
  {
    key: "visit_reminders",
    label: "Webhook dos lembretes de visita",
    url: "visit_reminders_webhook_url",
    secret: "visit_reminders_webhook_secret",
    route: "/api/cron/daily-digest/visit-reminders",
    missingStatus: "problema",
    missing:
      "Os lembretes de visita entram na fila e nunca saem (não há rotina da Vercel para eles).",
  },
]

/** Nomes pedidos a `platform_health(p_secret_names)`. */
export const PLATFORM_VAULT_SECRET_NAMES: readonly string[] = [
  ...EXPECTED_SERVER_KEY_SECRETS.map((secret) => secret.name),
  ...EXPECTED_WEBHOOK_SECRET_PAIRS.flatMap((pair) => [pair.url, pair.secret]),
]

function webhookAction(pair: ExpectedWebhookSecretPair, missing: readonly string[]): string {
  const commands = missing.map((name) =>
    name === pair.url
      ? `select vault.create_secret('https://<seu-dominio>${pair.route}', '${pair.url}');`
      : `select vault.create_secret('<mesmo valor de CRON_SECRET>', '${pair.secret}');`
  )

  return `No SQL Editor do Supabase: ${commands.join(" ")}`
}

/** Itens de saúde dos segredos do Vault a partir do mapa nome → existe. */
export function evaluateVaultSecrets(present: Readonly<Record<string, boolean>>): HealthItem[] {
  const keys = EXPECTED_SERVER_KEY_SECRETS.map<HealthItem>((secret) =>
    present[secret.name] === true
      ? {
          key: `vault_${secret.name}`,
          label: secret.label,
          reference: secret.name,
          status: "ok",
          detail: `Existe no Vault (o mesmo valor vai em ${secret.env}).`,
          action: null,
        }
      : {
          key: `vault_${secret.name}`,
          label: secret.label,
          reference: secret.name,
          status: "problema",
          detail: "Não existe no Vault: as RPCs desse grupo recusam todas as chamadas.",
          action:
            "Aplique as migrações pendentes (elas criam o segredo) e copie o valor para a variável do servidor.",
        }
  )

  const webhooks = EXPECTED_WEBHOOK_SECRET_PAIRS.map<HealthItem>((pair) => {
    const missing = [pair.url, pair.secret].filter((name) => present[name] !== true)
    const base = {
      key: `vault_${pair.key}`,
      label: pair.label,
      reference: `${pair.url}, ${pair.secret}`,
    }

    if (missing.length === 0) {
      return { ...base, status: "ok", detail: "Os dois segredos existem no Vault.", action: null }
    }

    if (missing.length === 1) {
      return {
        ...base,
        status: "problema",
        detail: `Só um dos dois segredos existe; falta ${missing[0]}. ${pair.missing}`,
        action: webhookAction(pair, missing),
      }
    }

    return {
      ...base,
      status: pair.missingStatus,
      detail: `Não configurado. ${pair.missing}`,
      action: webhookAction(pair, missing),
    }
  })

  return [...keys, ...webhooks]
}
