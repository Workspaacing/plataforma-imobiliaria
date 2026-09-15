"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { PLAN_KEYS, PLANS, type BillingInterval } from "@workspace/core/billing"
import { Button } from "@workspace/ui/components/button"

import { BillingIntervalToggle } from "@/components/billing/billing-interval-toggle"
import { PlanCard } from "@/components/billing/plan-card"
import {
  resolvePlanPricing,
  signUpHref,
  type CatalogPrices,
} from "@/components/billing/plan-content"

/** Alternância Mensal/Anual e os 4 cartões de /planos. */
export function PricingPlans({ prices }: { prices: CatalogPrices }) {
  const [interval, setBillingInterval] = React.useState<BillingInterval>("month")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <BillingIntervalToggle value={interval} onValueChange={setBillingInterval} />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {interval === "year"
            ? "No anual você paga 10 mensalidades e usa 12 meses, à vista."
            : "Mensal, sem fidelidade. Cancele quando quiser."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_KEYS.map((plan) => (
          <PlanCard
            key={plan}
            plan={plan}
            interval={interval}
            pricing={resolvePlanPricing(prices, plan, interval)}
            footer={
              <Button
                size="lg"
                variant={PLANS[plan].highlight ? "default" : "outline"}
                render={<Link href={signUpHref(plan)} />}
                nativeButton={false}
                aria-label={`Começar teste grátis no plano ${PLANS[plan].name}`}
              >
                Começar teste grátis
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            }
          />
        ))}
      </div>
    </div>
  )
}
