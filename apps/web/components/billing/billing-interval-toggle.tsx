"use client"

import type { BillingInterval } from "@workspace/core/billing"
import { Badge } from "@workspace/ui/components/badge"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

type BillingIntervalToggleProps = {
  value: BillingInterval
  onValueChange: (value: BillingInterval) => void
  disabled?: boolean
}

export function BillingIntervalToggle({
  value,
  onValueChange,
  disabled,
}: BillingIntervalToggleProps) {
  return (
    <ToggleGroup
      aria-label="Período de cobrança"
      variant="outline"
      value={[value]}
      disabled={disabled}
      onValueChange={(next) => {
        const selected = next[0]

        // Um período sempre fica marcado: clicar no ativo não desmarca.
        if (selected === "month" || selected === "year") {
          onValueChange(selected)
        }
      }}
    >
      <ToggleGroupItem value="month">Mensal</ToggleGroupItem>
      <ToggleGroupItem value="year">
        Anual
        <Badge variant="secondary">2 meses grátis</Badge>
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
