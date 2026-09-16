import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core", "@workspace/database"],
  // Sem experimental.inlineCss: com ele o CSS ia inline e repetido no payload do React
  // (HTML de 871 KB a cada primeiro acesso, sem cache do CSS, e um script inline enorme
  // apontado pelo PageSpeed). A folha externa fica em cache entre as páginas.
  // Sem productionBrowserSourceMaps: a Vercel responde 403 aos .map publicados, então só
  // alongavam o build.
  // Server Actions recebem senha, CPF e documentos: não imprimir argumentos no terminal.
  logging: {
    serverFunctions: false,
  },
  async headers() {
    // Impede embutir o CRM em iframe de terceiros (clickjacking em convites, equipe e
    // feed). Vale em qualquer ambiente: nenhum site de fora embute o app.
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`,
      },
      { key: "X-Frame-Options", value: "DENY" },
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

    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Link público da proposta: fora dos buscadores e sem vazar o token no
        // Referer de qualquer link que o cliente clique na página.
        // (Regra depois da geral: para a mesma chave, vale a última.)
        source: "/proposta/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ]
  },
}

export default nextConfig
