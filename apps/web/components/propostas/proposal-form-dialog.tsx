"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleAlertIcon } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { LISTING_PURPOSE_LABELS } from "@workspace/core/properties/enums"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { OptionCombobox, type ComboboxOption } from "@/components/propostas/option-combobox"
import { createProposal, updateProposal } from "@/lib/propostas/actions"
import { maskBrlInput } from "@/lib/propostas/money"
import { proposalFormSchema, type ProposalFormValues } from "@/lib/propostas/schemas"

export type ProposalPropertyOption = ComboboxOption & {
  purpose: "sale" | "rent" | "sale_rent"
}

export type EditableProposal = {
  id: string
  /** Proposta encerrada ou sem permissão: só leitura. */
  readOnly: boolean
  readOnlyReason: string | null
  values: ProposalFormValues
  propertyLabel: string
  clientLabel: string
  brokerLabel: string | null
}

const EMPTY_VALUES: ProposalFormValues = {
  propertyId: "",
  clientId: "",
  brokerId: "",
  purpose: "sale",
  amount: "",
  paymentTerms: "",
  conditions: "",
  validUntil: "",
}

function withFallback(options: ComboboxOption[], value: string | undefined, label: string) {
  return value && !options.some((option) => option.value === value)
    ? [...options, { value, label }]
    : options
}

type ProposalFormProps = {
  properties: ProposalPropertyOption[]
  clients: ComboboxOption[]
  brokers: ComboboxOption[]
  editing?: EditableProposal | null
  defaultPropertyId?: string
  defaultBrokerId?: string
  /**
   * Corretor e captador: na nova proposta o corretor é sempre o próprio
   * usuário (`defaultBrokerId`), sem opção de troca.
   */
  lockBroker?: boolean
}

type ProposalFormDialogProps = ProposalFormProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProposalFormDialog({ open, onOpenChange, ...formProps }: ProposalFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        {/* O conteúdo monta a cada abertura: o formulário sempre começa com os dados certos. */}
        <ProposalForm
          key={formProps.editing?.id ?? "nova-proposta"}
          {...formProps}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function getInitialValues({
  editing,
  properties,
  defaultPropertyId,
  defaultBrokerId,
}: ProposalFormProps): ProposalFormValues {
  if (editing) {
    return editing.values
  }

  const property = properties.find((option) => option.value === defaultPropertyId)

  return {
    ...EMPTY_VALUES,
    propertyId: property?.value ?? "",
    brokerId: defaultBrokerId ?? "",
    purpose: property?.purpose === "rent" ? "rent" : "sale",
  }
}

function ProposalForm({ onDone, ...props }: ProposalFormProps & { onDone: () => void }) {
  const { properties, clients, brokers, editing } = props
  const [isSubmitting, startSubmit] = React.useTransition()
  const [formError, setFormError] = React.useState<string | null>(null)
  const readOnly = editing?.readOnly ?? false
  const brokerLocked = !editing && Boolean(props.lockBroker)

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    mode: "onTouched",
    defaultValues: getInitialValues(props),
  })

  const propertyId = useWatch({ control: form.control, name: "propertyId" })

  const propertyOptions = React.useMemo(
    () => withFallback(properties, editing?.values.propertyId, editing?.propertyLabel ?? ""),
    [properties, editing]
  )

  const clientOptions = React.useMemo(
    () => withFallback(clients, editing?.values.clientId, editing?.clientLabel ?? ""),
    [clients, editing]
  )

  const brokerItems = React.useMemo(() => {
    const options = withFallback(
      brokers,
      editing?.values.brokerId || undefined,
      editing?.brokerLabel ?? "Ex-membro da equipe"
    )

    return [
      { label: "Sem corretor", value: null as string | null },
      ...options.map((option) => ({
        label: option.label,
        value: option.value as string | null,
      })),
    ]
  }, [brokers, editing])

  const selectedProperty = properties.find((option) => option.value === propertyId)
  const allowedPurposes =
    !selectedProperty || selectedProperty.purpose === "sale_rent"
      ? ["sale", "rent"]
      : [selectedProperty.purpose]

  function onSubmit(values: ProposalFormValues) {
    if (readOnly) return

    setFormError(null)

    startSubmit(async () => {
      const result = editing
        ? await updateProposal(editing.id, values)
        : await createProposal(values)

      if (!result.ok) {
        setFormError(result.error)
        return
      }

      toast.add({ title: result.message ?? "Proposta salva.", type: "success" })
      onDone()
    })
  }

  const title = editing ? (readOnly ? "Detalhes da proposta" : "Editar proposta") : "Nova proposta"
  const description = editing
    ? (editing.readOnlyReason ?? "Atualize os dados enquanto a proposta estiver em negociação.")
    : "A proposta começa como rascunho. Depois, marque como enviada quando apresentá-la."

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <FieldGroup>
          {formError ? (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Não foi possível salvar</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <Controller
            name="propertyId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} data-disabled={readOnly || undefined}>
                <FieldLabel htmlFor="proposta-imovel">Imóvel</FieldLabel>
                <OptionCombobox
                  id="proposta-imovel"
                  options={propertyOptions}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value)
                    const property = properties.find((option) => option.value === value)

                    if (property && property.purpose !== "sale_rent") {
                      form.setValue("purpose", property.purpose, {
                        shouldValidate: form.formState.isSubmitted,
                      })
                    }
                  }}
                  onBlur={field.onBlur}
                  placeholder="Buscar por código ou título"
                  emptyText="Nenhum imóvel encontrado."
                  disabled={readOnly}
                  invalid={fieldState.invalid}
                />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              name="clientId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} data-disabled={readOnly || undefined}>
                  <FieldLabel htmlFor="proposta-cliente">Cliente</FieldLabel>
                  <OptionCombobox
                    id="proposta-cliente"
                    options={clientOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Buscar pelo nome"
                    emptyText="Nenhum cliente a que você tenha acesso."
                    disabled={readOnly}
                    invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
            <Controller
              name="brokerId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field
                  data-invalid={fieldState.invalid}
                  data-disabled={readOnly || brokerLocked || undefined}
                >
                  <FieldLabel htmlFor="proposta-corretor">Corretor</FieldLabel>
                  <Select
                    items={brokerItems}
                    value={field.value || null}
                    onValueChange={(value: string | null) => field.onChange(value ?? "")}
                    onOpenChange={(isOpen) => {
                      if (!isOpen) field.onBlur()
                    }}
                    disabled={readOnly || brokerLocked}
                  >
                    <SelectTrigger
                      id="proposta-corretor"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {brokerItems.map((item) => (
                          <SelectItem key={item.value ?? "sem-corretor"} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : brokerLocked ? (
                    <FieldDescription>
                      Você fica como corretor das propostas que cadastra.
                    </FieldDescription>
                  ) : null}
                </Field>
              )}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              name="purpose"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} data-disabled={readOnly || undefined}>
                  <FieldTitle id="proposta-finalidade">Finalidade</FieldTitle>
                  <ToggleGroup
                    aria-labelledby="proposta-finalidade"
                    variant="outline"
                    value={[field.value]}
                    onValueChange={(value) => {
                      const next = value[0]
                      if (next === "sale" || next === "rent") field.onChange(next)
                    }}
                    disabled={readOnly}
                  >
                    <ToggleGroupItem value="sale" disabled={!allowedPurposes.includes("sale")}>
                      {LISTING_PURPOSE_LABELS.sale}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="rent" disabled={!allowedPurposes.includes("rent")}>
                      {LISTING_PURPOSE_LABELS.rent}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
            <Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} data-disabled={readOnly || undefined}>
                  <FieldLabel htmlFor="proposta-valor">Valor</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>R$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      {...field}
                      id="proposta-valor"
                      inputMode="numeric"
                      placeholder="0,00"
                      disabled={readOnly}
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => field.onChange(maskBrlInput(event.target.value))}
                    />
                  </InputGroup>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </div>
          <Controller
            name="validUntil"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                data-disabled={readOnly || undefined}
                className="sm:max-w-[calc(50%-0.625rem)]"
              >
                <FieldLabel htmlFor="proposta-validade">Validade (opcional)</FieldLabel>
                <Input
                  {...field}
                  id="proposta-validade"
                  type="date"
                  disabled={readOnly}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <FieldDescription>
                    Depois dessa data, a proposta aparece como vencida.
                  </FieldDescription>
                )}
              </Field>
            )}
          />
          <Controller
            name="paymentTerms"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} data-disabled={readOnly || undefined}>
                <FieldLabel htmlFor="proposta-pagamento">Forma de pagamento (opcional)</FieldLabel>
                <Textarea
                  {...field}
                  id="proposta-pagamento"
                  rows={3}
                  maxLength={5000}
                  placeholder="Ex.: 30% de entrada e financiamento bancário do restante"
                  disabled={readOnly}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <Controller
            name="conditions"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} data-disabled={readOnly || undefined}>
                <FieldLabel htmlFor="proposta-condicoes">Condições (opcional)</FieldLabel>
                <Textarea
                  {...field}
                  id="proposta-condicoes"
                  rows={3}
                  maxLength={5000}
                  placeholder="Ex.: desocupação em 60 dias, móveis planejados inclusos"
                  disabled={readOnly}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {readOnly ? "Fechar" : "Cancelar"}
          </DialogClose>
          {readOnly ? null : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {editing ? "Salvar alterações" : "Criar proposta"}
            </Button>
          )}
        </DialogFooter>
      </form>
    </>
  )
}
