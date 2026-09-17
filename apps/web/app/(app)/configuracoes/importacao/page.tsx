import type { Metadata } from "next"

import { ImportWizard } from "@/components/importacao/import-wizard"
import { PageHeading } from "@/components/crm/page-placeholder"
import { PageShell } from "@/components/shared/page-shell"
import { requireRole } from "@/lib/auth/session"
import { IMPORT_ROLES } from "@/lib/importacao/constants"
import { getImportMembers } from "@/lib/importacao/members"

export const metadata: Metadata = {
  title: "Importar planilhas",
}

/**
 * Importação de clientes, leads e imóveis por planilha (.csv ou .xlsx), em
 * passos: tipo, arquivo, colunas, conferência e gravação em lotes. Só dono e
 * gerente; a RPC do banco confere de novo.
 */
export default async function ImportacaoPage() {
  const { membership } = await requireRole(IMPORT_ROLES)
  const members = await getImportMembers(membership.organizationId)

  return (
    <PageShell
      variant="settings"
      width="wide"
      header={
        <PageHeading
          title="Importar planilhas"
          description="Traga clientes, leads e imóveis do sistema antigo ou do Excel sem digitar de novo."
        />
      }
    >
      <ImportWizard members={members} />
    </PageShell>
  )
}
