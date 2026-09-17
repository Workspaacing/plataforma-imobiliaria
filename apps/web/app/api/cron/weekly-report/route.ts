import { sendNotificationEmail } from "@/lib/email"
import { checkCronAuthorization, cronReply } from "@/lib/lembretes/cron-auth"
import { drainReminderQueue, logDrainSummary } from "@/lib/lembretes/drain"
import {
  claimWeeklyReports,
  settleWeeklyReports,
  type WeeklyReport,
} from "@/lib/lembretes/weekly-report"

/**
 * Relatório semanal ao gestor (Vercel Cron `0 10 * * 1` = segunda 07h de
 * Brasília; no Hobby dispara dentro da hora). Dono e gerentes com a preferência
 * ligada recebem os números da semana anterior (segunda a domingo): leads
 * recebidos, 1º contato mediano, visitas, propostas e ganhos por corretor.
 *
 * Os números vêm prontos do banco (claim_weekly_reports chama
 * report_broker_performance e report_broker_visits, as funções da tela
 * /relatorios). O controle private.weekly_report_deliveries impede o segundo
 * envio na mesma semana; semana sem números não gera e-mail.
 *
 * Autorização: `Authorization: Bearer ${CRON_SECRET}`. Resposta e logs só com
 * contagens.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Divide a cota diária da Brevo Free (300) com os demais avisos da segunda. */
const MAX_EMAILS_PER_RUN = 40

const BATCH_SIZE = 20

const MAX_BATCHES = 2

function send(item: WeeklyReport) {
  return sendNotificationEmail("weekly_report", {
    organizationSlug: item.organizationSlug,
    deliveryId: item.id,
    to: { email: item.recipientEmail, name: item.recipientName },
    brand: { name: item.organizationName || null, primaryColor: item.brandColor },
    report: item.report,
  })
}

export async function GET(request: Request) {
  const denied = checkCronAuthorization(request)

  if (denied) {
    return denied
  }

  const summary = await drainReminderQueue({
    claim: claimWeeklyReports,
    settle: settleWeeklyReports,
    send,
    maxEmails: MAX_EMAILS_PER_RUN,
    batchSize: BATCH_SIZE,
    maxBatches: MAX_BATCHES,
  })

  logDrainSummary("lembretes/semanal", summary)

  return cronReply(200, { ok: true, ...summary })
}
