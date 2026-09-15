import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core", "@workspace/database"],
  // Server Actions recebem senha, CPF e documentos: não imprimir argumentos no terminal.
  logging: {
    serverFunctions: false,
  },
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development"
    // Impede embutir o CRM em iframe de terceiros (clickjacking em convites, equipe e feed).
    // Em desenvolvimento, só o editor do tweakcn pode embutir o app para pré-visualizar temas.
    const frameAncestors = isDevelopment ? "'self' https://tweakcn.com" : "'none'"

    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: `frame-ancestors ${frameAncestors}; base-uri 'self'; form-action 'self'; object-src 'none'`,
      },
      ...(isDevelopment ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ]

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      })
    }

    return [{ source: "/(.*)", headers: securityHeaders }]
  },
}

export default nextConfig
