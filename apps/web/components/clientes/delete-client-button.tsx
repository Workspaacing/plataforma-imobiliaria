"use client"

import { useRouter } from "next/navigation"

import { ConfirmDeleteButton } from "@/components/clientes/confirm-delete-button"
import { deleteClientRecord } from "@/lib/clientes/actions"
import { CLIENTS_PATH } from "@/lib/clientes/constants"

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const router = useRouter()

  return (
    <ConfirmDeleteButton
      action={() => deleteClientRecord(clientId)}
      label="Excluir"
      showLabel
      title="Excluir este cliente?"
      description="A ficha, o histórico, os perfis de busca, os compartilhamentos e os documentos (inclusive os arquivos) serão apagados. Visitas e tarefas ligadas a ele também. Esta ação não pode ser desfeita."
      confirmLabel="Excluir cliente"
      onDone={() => router.push(CLIENTS_PATH)}
    />
  )
}
