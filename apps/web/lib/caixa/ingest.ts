import "server-only"

import { createHash } from "node:crypto"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { parseCaixaCsv } from "@workspace/core/caixa/csv"
import { caixaListingToRpcRow } from "@workspace/core/caixa/rpc-row"
import { CAIXA_LIST_URL, CAIXA_ORIGIN } from "@workspace/core/caixa/source"
import type { Database } from "@workspace/database/types"

import { getSupabaseEnv } from "@/lib/supabase/env"

/**
 * Sincronização do catálogo da Caixa por **requisição condicional**.
 *
 * A cada 30 minutos o cron pergunta se o arquivo mudou, mandando de volta o
 * `Last-Modified` (e o `ETag`, quando existe) da última carga:
 *
 * - `304 Not Modified` → não baixa, não analisa, não escreve no banco. Custa
 *   alguns cabeçalhos em vez de 2,83 MB;
 * - `200 OK` → baixa, valida e grava. Se o corpo vier idêntico ao anterior
 *   (comparação por SHA-256, para o caso de a resposta não trazer
 *   `Last-Modified`), o upsert é pulado do mesmo jeito.
 *
 * São 48 verificações por dia, quase todas de algumas centenas de bytes — menos
 * carga sobre a Caixa que um único download diário completo, e muito longe do
 * gatilho do bot manager (3 requisições em 60 s).
 *
 * **Falha não apaga nada e não repete na mesma execução.** Erro de rede, 5xx,
 * desafio de bot ou arquivo torto: registra o motivo, mantém o catálogo
 * anterior e espera os próximos 30 minutos. Insistir é exatamente o que dispara
 * o bloqueio, e contornar o desafio nunca é opção.
 */

/** Linhas por chamada à RPC (o jsonb inteiro não cabe num POST do PostgREST). */
const BATCH_SIZE = 500

/** Piso de registros para a carga valer (o arquivo nacional tem ~8.100). */
const MIN_LISTINGS = 1_000

/** Uma tentativa, 60 s. Sem laço de repetição. */
const FETCH_TIMEOUT_MS = 60_000

/** O arquivo tem ~2,9 MB; 20 MB é teto defensivo contra resposta inesperada. */
const MAX_BYTES = 20 * 1024 * 1024

const USER_AGENT =
  "PlataformaImobiliariaCRM/1.0 (catalogo de imoveis da Caixa; verificacao condicional a cada 30 min)"

type ServerClient = { supabase: SupabaseClient<Database>; serverKey: string }

type SourceHeaders = {
  lastModified: string | null
  etag: string | null
  digest: string | null
}

export type CaixaSyncOutcome =
  | {
      ok: true
      /** `changed`: o catálogo mudou. `not_modified`/`unchanged`: nada a fazer. */
      result: "changed" | "not_modified" | "unchanged"
      generatedOn: string | null
      received: number
      accepted: number
      inserted: number
      updated: number
      rejected: number
      delisted: number
      total: number
      batches: number
      /** Verificações sem mudança desde a mudança anterior. */
      checksSinceChange: number
    }
  | {
      ok: false
      /** Motivo estável, sem texto livre: vai para o log e para a resposta. */
      reason: string
      detail?: string
    }

function failed(reason: string, detail?: string): CaixaSyncOutcome {
  return detail ? { ok: false, reason, detail } : { ok: false, reason }
}

function quiet(result: "not_modified" | "unchanged", checksSinceChange: number): CaixaSyncOutcome {
  return {
    ok: true,
    result,
    generatedOn: null,
    received: 0,
    accepted: 0,
    inserted: 0,
    updated: 0,
    rejected: 0,
    delisted: 0,
    total: 0,
    batches: 0,
    checksSinceChange,
  }
}

function serverClient(serverKey: string): ServerClient | null {
  const env = getSupabaseEnv()

  if (!env) {
    return null
  }

  const supabase = createClient<Database>(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  return { supabase, serverKey }
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Registra a verificação que não mudou nada (ou que falhou). */
async function recordCheck(
  client: ServerClient,
  result: "not_modified" | "unchanged" | "falha",
  headers?: SourceHeaders,
  failureReason?: string
): Promise<number> {
  const { data } = await client.supabase.rpc("record_caixa_check", {
    p_server_key: client.serverKey,
    p_result: result,
    p_source_last_modified: headers?.lastModified ?? undefined,
    p_source_etag: headers?.etag ?? undefined,
    p_source_digest: headers?.digest ?? undefined,
    p_failure_reason: failureReason,
  })

  return Number(readRecord(data).checks_since_change ?? 0)
}

type DownloadResult =
  | { status: "not_modified" }
  | { status: "ok"; text: string; headers: SourceHeaders }
  | { status: "failed"; reason: string; detail?: string }

/**
 * Pergunta à Caixa se o arquivo mudou. Qualquer sinal de que não veio o CSV
 * esperado — fora do ar, redirecionamento para outro host (o desafio do bot
 * manager sai por aí), página HTML ou tamanho absurdo — vira falha, e falha
 * mantém o catálogo anterior.
 */
async function downloadListFile(previous: SourceHeaders): Promise<DownloadResult> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "text/csv,application/octet-stream;q=0.9,*/*;q=0.1",
  }

  if (previous.lastModified) {
    headers["If-Modified-Since"] = previous.lastModified
  }

  if (previous.etag) {
    headers["If-None-Match"] = previous.etag
  }

  let response: Response

  try {
    response = await fetch(CAIXA_LIST_URL, {
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    return { status: "failed", reason: "download_falhou" }
  }

  // O caso comum: nada mudou desde a última carga.
  if (response.status === 304) {
    return { status: "not_modified" }
  }

  if (!response.ok) {
    return { status: "failed", reason: "http_nao_ok", detail: String(response.status) }
  }

  // O desafio do bot manager responde com 302 para outro host. Se acontecer,
  // desistimos da rodada — nunca tentar resolver o desafio.
  if (response.url && !response.url.startsWith(`${CAIXA_ORIGIN}/`)) {
    return { status: "failed", reason: "redirecionado" }
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""

  if (contentType.includes("html")) {
    return { status: "failed", reason: "resposta_html" }
  }

  const declaredLength = Number(response.headers.get("content-length") ?? "0")

  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    return { status: "failed", reason: "arquivo_grande_demais", detail: String(declaredLength) }
  }

  let buffer: ArrayBuffer

  try {
    buffer = await response.arrayBuffer()
  } catch {
    return { status: "failed", reason: "leitura_falhou" }
  }

  if (buffer.byteLength > MAX_BYTES) {
    return { status: "failed", reason: "arquivo_grande_demais", detail: String(buffer.byteLength) }
  }

  const bytes = new Uint8Array(buffer)

  return {
    status: "ok",
    // O arquivo é publicado em Windows-1252, não em UTF-8.
    text: new TextDecoder("windows-1252").decode(bytes),
    headers: {
      lastModified: response.headers.get("last-modified"),
      etag: response.headers.get("etag"),
      digest: createHash("sha256").update(bytes).digest("hex"),
    },
  }
}

export async function runCaixaCatalogSync(): Promise<CaixaSyncOutcome> {
  const serverKey = process.env.CAIXA_SERVER_KEY?.trim()

  if (!serverKey) {
    return failed("sem_chave_do_servidor")
  }

  const client = serverClient(serverKey)

  if (!client) {
    return failed("supabase_nao_configurado")
  }

  const { data: stateData, error: stateError } = await client.supabase.rpc("get_caixa_sync_state", {
    p_server_key: client.serverKey,
  })

  if (stateError) {
    return failed("estado_indisponivel", stateError.code ?? undefined)
  }

  const state = readRecord(stateData)
  const previous: SourceHeaders = {
    lastModified: readString(state.source_last_modified),
    etag: readString(state.source_etag),
    digest: readString(state.source_digest),
  }

  const downloaded = await downloadListFile(previous)

  if (downloaded.status === "failed") {
    await recordCheck(client, "falha", undefined, downloaded.reason)
    return failed(downloaded.reason, downloaded.detail)
  }

  if (downloaded.status === "not_modified") {
    return quiet("not_modified", await recordCheck(client, "not_modified"))
  }

  // Sem `Last-Modified` na resposta, o SHA-256 do corpo ainda evita mexer no
  // banco à toa: baixou os 2,83 MB, mas não há o que gravar.
  if (previous.digest && downloaded.headers.digest === previous.digest) {
    return quiet("unchanged", await recordCheck(client, "unchanged", downloaded.headers))
  }

  const parsed = parseCaixaCsv(downloaded.text)

  if (!parsed.ok) {
    // Cabeçalho diferente = a Caixa mudou o formato. Abortar preserva o dado
    // anterior; o log traz o cabeçalho encontrado para a correção ser rápida.
    const reason = parsed.reason === "cabecalho" ? "cabecalho_mudou" : "arquivo_vazio"
    await recordCheck(client, "falha", undefined, reason)
    return failed(reason, parsed.foundHeader ?? undefined)
  }

  if (parsed.rows.length < MIN_LISTINGS) {
    await recordCheck(client, "falha", undefined, "poucos_registros")
    return failed("poucos_registros", String(parsed.rows.length))
  }

  const syncId = crypto.randomUUID()
  const totals = { received: 0, accepted: 0, inserted: 0, updated: 0, rejected: 0 }
  let batches = 0

  for (let start = 0; start < parsed.rows.length; start += BATCH_SIZE) {
    const batch = parsed.rows.slice(start, start + BATCH_SIZE).map(caixaListingToRpcRow)
    const { data, error } = await client.supabase.rpc("ingest_caixa_listings", {
      p_server_key: client.serverKey,
      p_sync_id: syncId,
      p_generated_on: parsed.generatedOn ?? undefined,
      p_rows: batch,
    })

    if (error) {
      // Sem fechar a carga, nada é marcado como "saiu da lista": o catálogo
      // anterior continua íntegro e a próxima verificação tenta de novo.
      await recordCheck(client, "falha", undefined, "gravacao_falhou")
      return failed("gravacao_falhou", error.code ?? undefined)
    }

    batches += 1

    const counts = readRecord(data)
    totals.received += Number(counts.received ?? 0)
    totals.accepted += Number(counts.accepted ?? 0)
    totals.inserted += Number(counts.inserted ?? 0)
    totals.updated += Number(counts.updated ?? 0)
    totals.rejected += Number(counts.rejected ?? 0)
  }

  const { data: finish, error: finishError } = await client.supabase.rpc("finish_caixa_sync", {
    p_server_key: client.serverKey,
    p_sync_id: syncId,
    p_generated_on: parsed.generatedOn ?? undefined,
    p_rejected: parsed.rejected.length + totals.rejected,
    p_source_last_modified: downloaded.headers.lastModified ?? undefined,
    p_source_etag: downloaded.headers.etag ?? undefined,
    p_source_digest: downloaded.headers.digest ?? undefined,
  })

  if (finishError) {
    await recordCheck(client, "falha", undefined, "fechamento_falhou")
    return failed("fechamento_falhou", finishError.code ?? undefined)
  }

  const summary = readRecord(finish)

  return {
    ok: true,
    result: "changed",
    generatedOn: parsed.generatedOn,
    received: totals.received,
    accepted: totals.accepted,
    inserted: totals.inserted,
    updated: totals.updated,
    // Linhas recusadas na leitura do arquivo + linhas recusadas no banco.
    rejected: parsed.rejected.length + totals.rejected,
    delisted: Number(summary.delisted ?? 0),
    total: Number(summary.total ?? 0),
    batches,
    checksSinceChange: Number(summary.checks_since_change ?? 0),
  }
}
