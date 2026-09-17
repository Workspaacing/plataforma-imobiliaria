"use client"

import * as React from "react"

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"

import { setEmailPreference } from "@/lib/lembretes/preference-actions"
import type { EmailPreferenceKey, EmailPreferences } from "@/lib/lembretes/preferences"

type PreferenceOption = {
  key: EmailPreferenceKey
  label: string
  description: string
}

const OPTIONS: readonly PreferenceOption[] = [
  {
    key: "daily_digest",
    label: "Resumo diário às 7h",
    description:
      "Tarefas de hoje e atrasadas, visitas do dia, leads sem contato e aniversariantes da sua carteira. Só chega quando há algo para ver.",
  },
  {
    key: "visit_reminders",
    label: "Lembrete de visita",
    description:
      "E-mail até 2 horas antes de cada visita em que você é o corretor, com o convite para o Google Agenda ou o Outlook.",
  },
  {
    key: "weekly_report",
    label: "Relatório semanal da equipe",
    description:
      "Toda segunda às 7h, os números da semana anterior por corretor. Só chega para dono e gerente.",
  },
]

function PreferenceSwitch({ option, checked }: { option: PreferenceOption; checked: boolean }) {
  const [optimistic, setOptimistic] = React.useOptimistic(checked)
  const [isPending, startTransition] = React.useTransition()
  const id = `email-preferencia-${option.key}`

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
        <FieldDescription>{option.description}</FieldDescription>
      </FieldContent>
      <Switch
        id={id}
        checked={optimistic}
        disabled={isPending}
        onCheckedChange={(next) => {
          startTransition(async () => {
            setOptimistic(next)
            const result = await setEmailPreference({ key: option.key, enabled: next })

            toast.add(
              result.ok
                ? { title: result.message ?? "Preferência salva.", type: "success" }
                : { title: "Não foi possível salvar", description: result.error, type: "error" }
            )
          })
        }}
      />
    </Field>
  )
}

/** Liga e desliga os e-mails automáticos (salva a cada troca). */
export function EmailPreferencesForm({ preferences }: { preferences: EmailPreferences }) {
  return (
    <FieldGroup>
      {OPTIONS.map((option) => (
        <PreferenceSwitch key={option.key} option={option} checked={preferences[option.key]} />
      ))}
    </FieldGroup>
  )
}
