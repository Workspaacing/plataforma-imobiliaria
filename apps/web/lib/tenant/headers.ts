/**
 * Header interno com o slug da imobiliária do subdomínio. Só o proxy define:
 * ele remove qualquer valor vindo do cliente antes de gravar o seu. O servidor
 * ainda confere o valor contra o Host (ver lib/tenant/server.ts).
 */
export const TENANT_SLUG_HEADER = "x-tenant-slug"
