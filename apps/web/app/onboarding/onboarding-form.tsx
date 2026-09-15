"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleAlertIcon, SearchIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
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

import { createOrganization, lookupCnpj } from "@/app/onboarding/actions"
import {
  BRAZILIAN_STATES,
  formatCnpj,
  isValidCnpj,
  normalizeCnpj,
  organizationSchema,
  slugify,
  type OrganizationValues,
} from "@/app/onboarding/schema"

const STATE_ITEMS = [
  { label: "Selecione", value: null },
  ...BRAZILIAN_STATES.map((state) => ({
    label: `${state.code} · ${state.name}`,
    value: state.code,
  })),
]

type LookupFeedback = {
  type: "success" | "warning" | "error"
  message: string
} | null

export function OnboardingForm() {
  const [isSubmitting, startSubmit] = React.useTransition()
  const [isLookingUp, startLookup] = React.useTransition()
  const [formError, setFormError] = React.useState<string | null>(null)
  const [lookupFeedback, setLookupFeedback] = React.useState<LookupFeedback>(null)
  const slugEditedRef = React.useRef(false)
  const lastLookupRef = React.useRef<string | null>(null)

  const form = useForm<OrganizationValues>({
    resolver: zodResolver(organizationSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      slug: "",
      legalName: "",
      cnpj: "",
      creci: "",
      city: "",
      state: "",
    },
  })

  function runLookup(rawCnpj: string) {
    const cnpj = normalizeCnpj(rawCnpj)

    if (!isValidCnpj(cnpj)) {
      form.setError("cnpj", { type: "manual", message: "CNPJ inválido. Confira os números." })
      return
    }

    lastLookupRef.current = cnpj
    setLookupFeedback(null)

    startLookup(async () => {
      const result = await lookupCnpj(cnpj)

      if (!result.ok) {
        setLookupFeedback({ type: "error", message: result.error })
        return
      }

      const options = { shouldDirty: true, shouldValidate: true }
      const { legalName, tradeName, city, state } = result.data

      form.setValue("legalName", legalName, options)

      if (city) form.setValue("city", city, options)
      if (state) form.setValue("state", state, options)

      if (!form.getValues("name").trim()) {
        const name = tradeName ?? legalName
        form.setValue("name", name, options)

        if (!slugEditedRef.current) {
          form.setValue("slug", slugify(name), options)
        }
      }

      setLookupFeedback(
        result.warning
          ? { type: "warning", message: result.warning }
          : {
              type: "success",
              message: "Dados preenchidos a partir da Receita Federal. Confira antes de continuar.",
            }
      )
    })
  }

  function onSubmit(values: OrganizationValues) {
    setFormError(null)

    startSubmit(async () => {
      const result = await createOrganization(values)

      if (!result) {
        return
      }

      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (message) {
          form.setError(field as keyof OrganizationValues, { type: "server", message })
        }
      }

      setFormError(result.error)
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {formError ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Não foi possível criar a imobiliária</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <FieldSet>
          <FieldLegend>Identificação</FieldLegend>
          <FieldDescription>Como a imobiliária aparece para a equipe e para os clientes.</FieldDescription>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-nome">Nome da imobiliária</FieldLabel>
                  <Input
                    {...field}
                    id="org-nome"
                    autoComplete="organization"
                    placeholder="Ex.: Horizonte Imóveis"
                    aria-invalid={fieldState.invalid}
                    onChange={(event) => {
                      field.onChange(event)

                      if (!slugEditedRef.current) {
                        form.setValue("slug", slugify(event.target.value), {
                          shouldValidate: form.formState.isSubmitted,
                        })
                      }
                    }}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
            <Controller
              name="slug"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-slug">Endereço</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>captar/</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      {...field}
                      id="org-slug"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="horizonte-imoveis"
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => {
                        const slug = event.target.value.toLowerCase().replace(/\s+/g, "-")
                        slugEditedRef.current = slug.length > 0
                        field.onChange(slug)
                      }}
                    />
                  </InputGroup>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <FieldDescription>
                      Gerado a partir do nome. Letras minúsculas, números e hífen; usado nos links públicos.
                    </FieldDescription>
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>Dados legais</FieldLegend>
          <FieldDescription>Informe o CNPJ para preencher a razão social e o endereço automaticamente.</FieldDescription>
          <FieldGroup>
            <Controller
              name="cnpj"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-cnpj">CNPJ (opcional)</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      {...field}
                      id="org-cnpj"
                      autoComplete="off"
                      placeholder="00.000.000/0000-00"
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => {
                        const formatted = formatCnpj(event.target.value)
                        const cnpj = normalizeCnpj(formatted)
                        field.onChange(formatted)

                        if (cnpj.length === 14 && isValidCnpj(cnpj) && cnpj !== lastLookupRef.current) {
                          runLookup(cnpj)
                        }
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        onClick={() => runLookup(field.value)}
                        disabled={isLookingUp || normalizeCnpj(field.value).length !== 14}
                      >
                        {isLookingUp ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <SearchIcon data-icon="inline-start" />
                        )}
                        Consultar
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : lookupFeedback?.type === "error" ? (
                    <FieldError>{lookupFeedback.message}</FieldError>
                  ) : (
                    <FieldDescription>
                      {lookupFeedback?.message ??
                        "Consultamos a Receita Federal pela BrasilAPI."}
                    </FieldDescription>
                  )}
                </Field>
              )}
            />
            <Controller
              name="legalName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-razao-social">Razão social</FieldLabel>
                  <Input
                    {...field}
                    id="org-razao-social"
                    placeholder="Ex.: Horizonte Negócios Imobiliários Ltda."
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
            <Controller
              name="creci"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-creci">CRECI jurídico</FieldLabel>
                  <Input
                    {...field}
                    id="org-creci"
                    autoComplete="off"
                    placeholder="Ex.: J-12345"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>Localização</FieldLegend>
          <div className="grid gap-5 sm:grid-cols-[1fr_14rem]">
            <Controller
              name="city"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-cidade">Cidade</FieldLabel>
                  <Input
                    {...field}
                    id="org-cidade"
                    autoComplete="address-level2"
                    placeholder="Ex.: Campinas"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
            <Controller
              name="state"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-uf">UF</FieldLabel>
                  <Select
                    items={STATE_ITEMS}
                    value={field.value ? field.value : null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    onOpenChange={(open) => {
                      if (!open) field.onBlur()
                    }}
                  >
                    <SelectTrigger
                      id="org-uf"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {BRAZILIAN_STATES.map((state) => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.code} · {state.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </div>
        </FieldSet>

        <Field orientation="horizontal" className="justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
            Criar imobiliária
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
