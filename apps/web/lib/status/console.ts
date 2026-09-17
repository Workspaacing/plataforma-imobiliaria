import "server-only"

import { z } from "zod"

import type {
  AnyIncidentStatus,
  IncidentCreatePayload,
  IncidentEditPayload,
  IncidentKind,
  IncidentUpdatePayload,
} from "@workspace/core/status/incidents"
import type { IncidentImpact, StatusComponentKey, StatusLevel } from "@workspace/core/status/public"

import {
  PlatformRpcError,
  throwPlatformRpcError,
  withPlatformRpc,
  type PlatformRpcFailure,
  type PlatformRpcResult,
} from "@/lib/plataforma/rpc"

/**
 * Status público no Console da Plataforma (/plataforma/status): incidentes e
 * manutenções escritos pela equipe e as medições automáticas por parte.
 *
 * Mesmo contrato das outras telas do console: RPCs `platform_status_*` com a
 * chave do servidor, chamadas por `withPlatformRpc` (confere o administrador de
 * novo). Toda mudança grava o registro do console na mesma transação, dentro da
 * própria RPC; quem agiu vem da sessão, nunca do formulário.
 */

export const PLATFORM_STATUS_PATH = "/plataforma/status"

/** Resultado da última sonda HTTP ao app (/api/status/ping), só para o console. */
export const STATUS_PROBE_RESULTS = [
  "ok",
  "lento",
  "http_erro",
  "http_configuracao",
  "tempo_esgotado",
  "erro_conexao",
  "resposta_invalida",
  "sem_resposta",
  "sem_url",
  "falha_ao_enviar",
] as const

export type StatusProbeResult = (typeof STATUS_PROBE_RESULTS)[number]

export type StatusProbeState = {
  /** O segredo status_probe_url existe no Vault (com https)? */
  urlConfigured: boolean
  /** A rotina status-publico-medicoes existe e está ativa? null = não existe. */
  jobActive: boolean | null
  lastSentAt: string | null
  lastCheckedAt: string | null
  lastResult: StatusProbeResult | null
  lastHttpStatus: number | null
  lastDurationMs: number | null
}

export type StatusMeasurement = {
  measuredAt: string
  /** O que a medição viu agora. */
  measuredLevel: StatusLevel
  /** Nível automático depois da histerese; null antes do primeiro nível confirmado. */
  level: StatusLevel | null
  /** Código curto interno do motivo (ex.: http_503, fila_atrasada). Nunca vai ao público. */
  detail: string | null
}

export type StatusConsoleComponent = {
  key: StatusComponentKey
  /** automatic = há sinal automático; manual = só incidente/manutenção (ex.: billing). */
  source: "automatic" | "manual"
  /** Nível automático estável (histerese); null sem medição confirmada. */
  automaticLevel: StatusLevel | null
  /** Nível diferente esperando a 2ª medição igual para valer. */
  candidateLevel: StatusLevel | null
  candidateCount: number
  lastMeasuredAt: string | null
  lastDetail: string | null
  /** Quando o nível automático mudou pela última vez. */
  changedAt: string | null
  /** Medições mais recentes, da mais nova para a mais antiga. */
  recent: StatusMeasurement[]
}

export type StatusConsoleOverview = {
  generatedAt: string
  probe: StatusProbeState
  components: StatusConsoleComponent[]
}

export type StatusConsoleIncidentUpdate = {
  id: number
  status: AnyIncidentStatus
  message: string
  createdAt: string
}

export type StatusConsoleIncident = {
  id: string
  kind: IncidentKind
  title: string
  impact: IncidentImpact
  /** Estado gravado pela equipe. */
  status: AnyIncidentStatus
  /** Estado que o público vê (manutenção agendada anda sozinha pelo relógio). */
  effectiveStatus: AnyIncidentStatus
  componentKeys: StatusComponentKey[]
  startedAt: string
  /** Fim efetivo (inclui manutenção concluída pelo horário previsto). */
  resolvedAt: string | null
  scheduledFor: string | null
  scheduledUntil: string | null
  createdAt: string
  updatedAt: string
  /** Da mais recente para a mais antiga. */
  updates: StatusConsoleIncidentUpdate[]
}

const levelSchema = z.enum([
  "operational",
  "degraded_performance",
  "partial_outage",
  "major_outage",
  "under_maintenance",
])
const componentKeySchema = z.enum([
  "crm",
  "login",
  "leads_capture",
  "lead_routing",
  "notifications",
  "integrations",
  "caixa_catalog",
  "billing",
])
const incidentStatusSchema = z.enum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "scheduled",
  "in_progress",
  "completed",
])

const overviewSchema = z.object({
  generated_at: z.string(),
  probe: z.object({
    url_configured: z.boolean(),
    job_active: z.boolean().nullable(),
    last_sent_at: z.string().nullable(),
    last_checked_at: z.string().nullable(),
    last_result: z.enum(STATUS_PROBE_RESULTS).nullable(),
    last_http_status: z.number().int().nullable(),
    last_duration_ms: z.number().int().nullable(),
  }),
  components: z.array(
    z.object({
      key: componentKeySchema,
      source: z.enum(["automatic", "manual"]),
      automatic_level: levelSchema.nullable(),
      candidate_level: levelSchema.nullable(),
      candidate_count: z.number().int().nonnegative(),
      last_measured_at: z.string().nullable(),
      last_detail: z.string().nullable(),
      changed_at: z.string().nullable(),
      recent: z.array(
        z.object({
          measured_at: z.string(),
          measured_level: levelSchema,
          level: levelSchema.nullable(),
          detail: z.string().nullable(),
        })
      ),
    })
  ),
})

const incidentsSchema = z.array(
  z.object({
    id: z.string(),
    kind: z.enum(["incident", "maintenance"]),
    title: z.string(),
    impact: z.enum(["none", "minor", "major", "critical"]),
    status: incidentStatusSchema,
    effective_status: incidentStatusSchema,
    component_keys: z.array(componentKeySchema),
    started_at: z.string(),
    resolved_at: z.string().nullable(),
    scheduled_for: z.string().nullable(),
    scheduled_until: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    updates: z.array(
      z.object({
        id: z.number().int(),
        status: incidentStatusSchema,
        message: z.string(),
        created_at: z.string(),
      })
    ),
  })
)

/** Medições automáticas e estado da sonda (`platform_status_overview`). */
export async function getStatusConsoleOverview(): Promise<
  PlatformRpcResult<StatusConsoleOverview>
> {
  const operation = "platform_status_overview"

  return withPlatformRpc(operation, async ({ supabase, serverKey }) => {
    const { data, error } = await supabase.rpc(operation, {
      p_server_key: serverKey,
      p_samples_per_component: 15,
    })

    if (error) {
      throwPlatformRpcError(operation, error)
    }

    const parsed = overviewSchema.safeParse(data)

    if (!parsed.success) {
      throw new PlatformRpcError(operation, null, "dados_invalidos")
    }

    const { probe } = parsed.data

    return {
      generatedAt: parsed.data.generated_at,
      probe: {
        urlConfigured: probe.url_configured,
        jobActive: probe.job_active,
        lastSentAt: probe.last_sent_at,
        lastCheckedAt: probe.last_checked_at,
        lastResult: probe.last_result,
        lastHttpStatus: probe.last_http_status,
        lastDurationMs: probe.last_duration_ms,
      },
      components: parsed.data.components.map((component) => ({
        key: component.key,
        source: component.source,
        automaticLevel: component.automatic_level,
        candidateLevel: component.candidate_level,
        candidateCount: component.candidate_count,
        lastMeasuredAt: component.last_measured_at,
        lastDetail: component.last_detail,
        changedAt: component.changed_at,
        recent: component.recent.map((sample) => ({
          measuredAt: sample.measured_at,
          measuredLevel: sample.measured_level,
          level: sample.level,
          detail: sample.detail,
        })),
      })),
    }
  })
}

/** Incidentes e manutenções, do mais novo para o mais antigo (`platform_status_list_incidents`). */
export async function listStatusIncidents(): Promise<PlatformRpcResult<StatusConsoleIncident[]>> {
  const operation = "platform_status_list_incidents"

  return withPlatformRpc(operation, async ({ supabase, serverKey }) => {
    const { data, error } = await supabase.rpc(operation, {
      p_server_key: serverKey,
      p_limit: 100,
    })

    if (error) {
      throwPlatformRpcError(operation, error)
    }

    const parsed = incidentsSchema.safeParse(data)

    if (!parsed.success) {
      throw new PlatformRpcError(operation, null, "dados_invalidos")
    }

    return parsed.data.map((incident) => ({
      id: incident.id,
      kind: incident.kind,
      title: incident.title,
      impact: incident.impact,
      status: incident.status,
      effectiveStatus: incident.effective_status,
      componentKeys: incident.component_keys,
      startedAt: incident.started_at,
      resolvedAt: incident.resolved_at,
      scheduledFor: incident.scheduled_for,
      scheduledUntil: incident.scheduled_until,
      createdAt: incident.created_at,
      updatedAt: incident.updated_at,
      updates: incident.updates.map((update) => ({
        id: update.id,
        status: update.status,
        message: update.message,
        createdAt: update.created_at,
      })),
    }))
  })
}

/** Cria incidente (com a primeira atualização) ou agenda manutenção. */
export async function createStatusIncident(
  payload: IncidentCreatePayload
): Promise<PlatformRpcResult<{ id: string }>> {
  const operation = "platform_status_create_incident"

  return withPlatformRpc(operation, async ({ supabase, serverKey, admin }) => {
    const { data, error } = await supabase.rpc(operation, {
      p_server_key: serverKey,
      p_actor_user_id: admin.id,
      p_actor_email: admin.email,
      p_kind: payload.kind,
      p_title: payload.title,
      p_impact: payload.impact,
      p_component_keys: payload.componentKeys,
      p_message: payload.message,
      p_status: payload.status ?? undefined,
      p_scheduled_for: payload.scheduledFor ?? undefined,
      p_scheduled_until: payload.scheduledUntil ?? undefined,
    })

    if (error) {
      throwPlatformRpcError(operation, error)
    }

    if (typeof data !== "string") {
      throw new PlatformRpcError(operation, null, "dados_invalidos")
    }

    return { id: data }
  })
}

/** Publica uma atualização (muda o estado; resolvido/concluída encerra). */
export async function addStatusIncidentUpdate(
  incidentId: string,
  payload: IncidentUpdatePayload
): Promise<PlatformRpcResult<{ id: number }>> {
  const operation = "platform_status_add_update"

  return withPlatformRpc(operation, async ({ supabase, serverKey, admin }) => {
    const { data, error } = await supabase.rpc(operation, {
      p_server_key: serverKey,
      p_actor_user_id: admin.id,
      p_actor_email: admin.email,
      p_incident_id: incidentId,
      p_status: payload.status,
      p_message: payload.message,
    })

    if (error) {
      throwPlatformRpcError(operation, error)
    }

    if (typeof data !== "number") {
      throw new PlatformRpcError(operation, null, "dados_invalidos")
    }

    return { id: data }
  })
}

/** Edita título, impacto e partes afetadas (e a janela da manutenção ainda agendada). */
export async function editStatusIncident(
  incidentId: string,
  payload: IncidentEditPayload
): Promise<PlatformRpcResult<{ id: string }>> {
  const operation = "platform_status_edit_incident"

  return withPlatformRpc(operation, async ({ supabase, serverKey, admin }) => {
    const { data, error } = await supabase.rpc(operation, {
      p_server_key: serverKey,
      p_actor_user_id: admin.id,
      p_actor_email: admin.email,
      p_incident_id: incidentId,
      p_title: payload.title,
      p_impact: payload.impact,
      p_component_keys: payload.componentKeys,
      p_scheduled_for: payload.scheduledFor ?? undefined,
      p_scheduled_until: payload.scheduledUntil ?? undefined,
    })

    if (error) {
      throwPlatformRpcError(operation, error)
    }

    if (typeof data !== "string") {
      throw new PlatformRpcError(operation, null, "dados_invalidos")
    }

    return { id: data }
  })
}

/** Frase para a tela a partir do código do banco (sem o texto do erro). */
export function statusIncidentFailureMessage(failure: PlatformRpcFailure): string {
  switch (failure.code) {
    case "22023":
      return "O registro já foi encerrado, o estado não vale para este tipo ou a janela da manutenção é inválida. Atualize a página e confira."
    case "P0002":
      return "Este registro não existe mais. Atualize a página."
    case "23514":
      return "Algum campo está fora das regras (título, mensagem, partes ou horários). Confira e tente de novo."
    default:
      return failure.message
  }
}
