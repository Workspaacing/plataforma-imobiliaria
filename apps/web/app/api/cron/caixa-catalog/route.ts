import { createHash, timingSafeEqual } from "node:crypto"

import { runCaixaCatalogSync } from "@/lib/caixa/ingest"

/**
 * Verificação do catálogo de imóveis da Caixa (Vercel Cron, a cada 30 min).
 *
 * Enquanto o time da Vercel estiver no plano Hobby, o `vercel.json` agenda esta
 * rota uma vez por dia: o Hobby recusa o deploy de cron mais frequente que
 * diário (vercel.com/docs/cron-jobs/usage-and-pricing). Ao passar para o Pro,
 * volte o agendamento para `7,37 * * * *` (e o de lead-ingest para `13,43 * * * *`).
 *
 * Não baixa o arquivo toda vez: manda o `Last-Modified` da última carga como
 * `If-Modified-Since` e, na esmagadora maioria das execuções, recebe um
 * `304 Not Modified` de algumas centenas de bytes — nada é baixado, analisado
 * ou gravado. Só quando a Caixa responde `200` é que os 2,83 MB vêm e o
 * catálogo é atualizado.
 *
 * Não raspa o formulário de busca, não abre página de detalhe, não busca os 27
 * arquivos por UF (o nacional já traz os 8.094 imóveis, conferidos contra a
 * soma dos estados) e nunca tenta contornar o bot manager do site: resposta
 * inesperada vira "não deu para atualizar agora", o catálogo anterior continua
 * valendo e a próxima verificação vem em 30 minutos — sem repetir na mesma
 * execução, porque insistir é o que dispara o bloqueio.
 *
 * Autorização: `Authorization: Bearer ${CRON_SECRET}` (comparação em tempo
 * constante), igual às rotas billing-reminders e lead-alerts. Resposta e logs
 * só com contagens — nenhum dado de imóvel.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * O 304 responde em milissegundos; a execução longa é só a da rodada em que o
 * arquivo mudou (parse de ~8.100 linhas + 17 chamadas ao banco: 10–20 s).
 * Estourar o tempo não estraga nada: sem a chamada de fechamento, ninguém é
 * marcado como "saiu da lista" e o catálogo anterior continua íntegro.
 */
export const maxDuration = 60

function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest()
}

/** Compara os hashes (mesmo tamanho) para não vazar o segredo pelo tempo de resposta. */
function isAuthorized(header: string | null, secret: string) {
  return timingSafeEqual(sha256(header ?? ""), sha256(`Bearer ${secret}`))
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()

  if (!secret) {
    console.error("CRON_SECRET ausente")
    return reply(500, { error: "not_configured" })
  }

  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return reply(401, { error: "unauthorized" })
  }

  const result = await runCaixaCatalogSync()

  if (!result.ok) {
    // Não é erro de servidor: é a rodada em que não deu para atualizar. 200
    // para o cron não ficar marcado como falho, com o motivo no corpo e no log.
    console.error(
      `[caixa/cron] sem atualização (${result.reason}${result.detail ? `: ${result.detail}` : ""})`
    )

    return reply(200, { ok: false, skipped: result.reason })
  }

  if (result.result !== "changed") {
    // Caso comum: o arquivo não mudou desde a última carga. Sem log de erro.
    return reply(200, {
      ok: true,
      result: result.result,
      checksSinceChange: result.checksSinceChange,
    })
  }

  console.log(
    `[caixa/cron] lista de ${result.generatedOn ?? "data desconhecida"}: ` +
      `${result.inserted} novos, ${result.updated} atualizados, ` +
      `${result.rejected} recusados, ${result.delisted} fora da lista, ${result.total} ativos ` +
      `(${result.checksSinceChange} verificações desde a mudança anterior)`
  )

  return reply(200, {
    ok: true,
    result: result.result,
    generatedOn: result.generatedOn,
    received: result.received,
    inserted: result.inserted,
    updated: result.updated,
    rejected: result.rejected,
    delisted: result.delisted,
    total: result.total,
    batches: result.batches,
    checksSinceChange: result.checksSinceChange,
  })
}
