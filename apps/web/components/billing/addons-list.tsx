import { ADDONS, PLAN_KEYS, PLANS } from "@workspace/core/billing"
import { Badge } from "@workspace/ui/components/badge"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"

/** Add-ons "em breve", com preço, sem compra na v1. */
export function AddonsList() {
  return (
    <div className="flex flex-col gap-4">
      <ItemGroup className="grid gap-3 md:grid-cols-2">
        {ADDONS.map((addon) => (
          <Item key={addon.key} variant="outline" role="listitem" className="items-start">
            <ItemContent>
              <ItemTitle>
                {addon.name}
                <Badge variant="outline">Em breve</Badge>
              </ItemTitle>
              <ItemDescription>{addon.description}</ItemDescription>
              <p className="font-medium tabular-nums">{addon.priceLabel}</p>
              {addon.plans.length < PLAN_KEYS.length ? (
                <p className="text-muted-foreground">
                  {addon.plans.length === 1 ? "Plano" : "Planos"}:{" "}
                  {addon.plans.map((plan) => PLANS[plan].name).join(", ")}
                </p>
              ) : null}
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      <p className="text-sm text-muted-foreground">
        Conectar um domínio que já é seu não tem custo. Não cobramos implantação, hora técnica nem
        pacote de imóveis.
      </p>
    </div>
  )
}
