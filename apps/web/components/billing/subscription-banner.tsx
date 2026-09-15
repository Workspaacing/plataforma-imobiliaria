import Link from "next/link"
import { CircleAlertIcon, ClockIcon, LockIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"

import { loadBillingOverview } from "@/components/billing/billing-data"
import { getBannerMessage } from "@/components/billing/overview-view"
import { hasRole, ORGANIZATION_VIEWER_ROLES, type Role } from "@/lib/auth/roles"
import { SUBSCRIPTION_SETTINGS_PATH } from "@/lib/auth/routes"

type SubscriptionBannerProps = {
  organizationId: string
  role: Role
}

/**
 * Aviso global da casca do CRM: teste com até 3 dias, carência ou modo leitura.
 * Sem resumo (RPC indisponível) ou fora desses estados, não renderiza nada.
 */
export async function SubscriptionBanner({ organizationId, role }: SubscriptionBannerProps) {
  const overview = await loadBillingOverview(organizationId)
  const message = overview ? getBannerMessage(overview) : null

  if (!overview || !message) {
    return null
  }

  const Icon =
    overview.state === "read_only"
      ? LockIcon
      : overview.state === "grace"
        ? CircleAlertIcon
        : ClockIcon

  return (
    <div className="px-4 pt-4 lg:px-6">
      <Alert variant={overview.state === "trialing" ? "default" : "destructive"} role="status">
        <Icon />
        <AlertTitle>{message.title}</AlertTitle>
        <AlertDescription>
          {hasRole(role, ORGANIZATION_VIEWER_ROLES) ? (
            <Link href={SUBSCRIPTION_SETTINGS_PATH}>
              {overview.state === "grace" && overview.hasSubscription
                ? "Regularizar o pagamento"
                : "Ver planos e assinar"}
            </Link>
          ) : (
            "Avise o dono da imobiliária para regularizar a assinatura."
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}
