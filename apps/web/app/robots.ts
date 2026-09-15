import type { MetadataRoute } from "next"

/**
 * robots.txt servido pelo próprio app (sem ele, /robots.txt caía no 404 em HTML).
 * Rotas de API, autenticação e convites não são indexadas; o CRM já exige login.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/convite/", "/onboarding", "/imobiliarias"],
    },
  }
}
