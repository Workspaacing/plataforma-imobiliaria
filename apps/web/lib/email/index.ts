import "server-only"

export {
  sendNotificationEmail,
  type AiQuotaNoticeNotification,
  type AuthorizationExpiringNotification,
  type CaptureRequestNotification,
  type LeadSlaNoticeNotification,
  type NewLeadNotification,
  type NotificationKind,
  type NotificationParams,
  type NotificationSummary,
  type ReferralNoticeNotification,
  type SubscriptionNoticeNotification,
  type TeamInvitationNotification,
} from "@/lib/email/notifications"
export { getEmailProvider } from "@/lib/email/provider"
export type {
  EmailAddress,
  EmailFailureReason,
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from "@/lib/email/types"
