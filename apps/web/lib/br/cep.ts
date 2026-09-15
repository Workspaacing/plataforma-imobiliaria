import "server-only"

export type CepAddress = {
  postalCode: string
  street: string
  neighborhood: string
  city: string
  state: string
}

const TIMEOUT_MS = 5000
const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: ONE_MONTH_SECONDS },
    })
    if (!response.ok) return null
    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

/** Consulta o CEP no ViaCEP e, se falhar, na BrasilAPI. Retorna null se não encontrar. */
export async function lookupCep(value: string): Promise<CepAddress | null> {
  const postalCode = value.replace(/\D/g, "")
  if (postalCode.length !== 8) return null

  const viaCep = await fetchJson(`https://viacep.com.br/ws/${postalCode}/json/`)
  if (viaCep && !viaCep.erro && text(viaCep.localidade)) {
    return {
      postalCode,
      street: text(viaCep.logradouro),
      neighborhood: text(viaCep.bairro),
      city: text(viaCep.localidade),
      state: text(viaCep.uf),
    }
  }

  const brasilApi = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${postalCode}`)
  if (brasilApi && text(brasilApi.city)) {
    return {
      postalCode,
      street: text(brasilApi.street),
      neighborhood: text(brasilApi.neighborhood),
      city: text(brasilApi.city),
      state: text(brasilApi.state),
    }
  }

  return null
}
