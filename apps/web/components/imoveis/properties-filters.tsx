"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FilterIcon, SearchIcon, XIcon } from "lucide-react"

import {
  LISTING_PURPOSE_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@workspace/core/properties/enums"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"

import { LISTING_PURPOSES, PROPERTY_STATUSES, PROPERTY_TYPES } from "@/lib/imoveis/constants"

export type PropertyFilterDefaults = {
  q: string
  status: string
  finalidade: string
  tipo: string
  precoMin: string
  precoMax: string
  quartos: string
}

type Option = { label: string; value: string | null }

const STATUS_ITEMS: Option[] = [
  { label: "Todos", value: null },
  ...PROPERTY_STATUSES.map((value) => ({ label: PROPERTY_STATUS_LABELS[value], value })),
]

const PURPOSE_ITEMS: Option[] = [
  { label: "Todas", value: null },
  ...LISTING_PURPOSES.map((value) => ({ label: LISTING_PURPOSE_LABELS[value], value })),
]

const TYPE_ITEMS: Option[] = [
  { label: "Todos", value: null },
  ...PROPERTY_TYPES.map((value) => ({ label: PROPERTY_TYPE_LABELS[value], value })),
]

const BEDROOM_ITEMS: Option[] = [
  { label: "Qualquer", value: null },
  ...["1", "2", "3", "4", "5"].map((value) => ({ label: `${value}+`, value })),
]

function FilterSelect({
  id,
  name,
  label,
  items,
  defaultValue,
}: {
  id: string
  name: string
  label: string
  items: Option[]
  defaultValue: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select name={name} items={items} defaultValue={defaultValue || null}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value ?? "todos"} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

/** Filtros da lista: viram searchParams e a consulta roda no servidor. */
export function PropertiesFilters({ defaults }: { defaults: PropertyFilterDefaults }) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const hasFilters = Object.values(defaults).some(Boolean)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()

    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim())
      }
    }

    const query = params.toString()
    startTransition(() => router.push(query ? `/imoveis?${query}` : "/imoveis"))
  }

  return (
    <form onSubmit={onSubmit} role="search" aria-label="Filtrar imóveis">
      <FieldGroup className="gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <Field>
            <FieldLabel htmlFor="filtro-busca">Buscar</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                id="filtro-busca"
                name="q"
                type="search"
                defaultValue={defaults.q}
                maxLength={100}
                placeholder="Código, título ou bairro"
              />
            </InputGroup>
          </Field>
          <FilterSelect id="filtro-status" name="status" label="Status" items={STATUS_ITEMS} defaultValue={defaults.status} />
          <FilterSelect
            id="filtro-finalidade"
            name="finalidade"
            label="Finalidade"
            items={PURPOSE_ITEMS}
            defaultValue={defaults.finalidade}
          />
          <FilterSelect id="filtro-tipo" name="tipo" label="Tipo" items={TYPE_ITEMS} defaultValue={defaults.tipo} />
        </div>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
          <Field>
            <FieldLabel htmlFor="filtro-preco-min">Preço mínimo</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>R$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="filtro-preco-min"
                name="precoMin"
                inputMode="numeric"
                defaultValue={defaults.precoMin}
                placeholder="0"
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="filtro-preco-max">Preço máximo</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>R$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="filtro-preco-max"
                name="precoMax"
                inputMode="numeric"
                defaultValue={defaults.precoMax}
                placeholder="Sem limite"
              />
            </InputGroup>
          </Field>
          <FilterSelect
            id="filtro-quartos"
            name="quartos"
            label="Quartos (mínimo)"
            items={BEDROOM_ITEMS}
            defaultValue={defaults.quartos}
          />
          <div className="flex gap-2 sm:col-span-3 xl:col-span-1">
            <Button type="submit" disabled={isPending} className="flex-1 xl:flex-none">
              {isPending ? <Spinner data-icon="inline-start" /> : <FilterIcon data-icon="inline-start" />}
              Filtrar
            </Button>
            {hasFilters ? (
              <Button variant="ghost" render={<Link href="/imoveis" />} nativeButton={false}>
                <XIcon data-icon="inline-start" />
                Limpar
              </Button>
            ) : null}
          </div>
        </div>
      </FieldGroup>
    </form>
  )
}
