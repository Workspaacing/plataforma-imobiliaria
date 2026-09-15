"use client"

import * as React from "react"
import Script from "next/script"

import { CookieConsentBanner } from "@/components/leads-publicos/cookie-consent-banner"
import { captureAttribution } from "@/lib/leads-publicos/attribution"
import { saveLandingConsent, useLandingConsent } from "@/lib/leads-publicos/consent"
import {
  safeGoogleTagId,
  safeGtmContainerId,
  safeMetaPixelId,
} from "@/lib/leads-publicos/tracking-ids"

type TrackingWindow = Window & {
  fbq?: (...args: unknown[]) => void
  gtag?: (...args: unknown[]) => void
  dataLayer?: unknown[]
}

type LandingTrackingProps = {
  /** tracking.meta_pixel_id da página (só dígitos). */
  metaPixelId?: string | null
  /** tracking.google_tag_id da página (G-, GT- ou AW-). */
  googleTagId?: string | null
  /** tracking.gtm_container_id da página (GTM-). */
  gtmContainerId?: string | null
  privacyHref: string
}

/**
 * Rastreamento da landing page:
 * - guarda UTMs e click ids first-party ao chegar (sempre);
 * - com algum rastreador configurado, mostra o aviso de cookies e só carrega
 *   Meta Pixel, gtag.js e GTM depois de "Aceitar" (cookie `lp_consent`).
 * Os IDs são revalidados por regex e interpolados com JSON.stringify.
 */
export function LandingTracking({
  metaPixelId,
  googleTagId,
  gtmContainerId,
  privacyHref,
}: LandingTrackingProps) {
  const pixelId = safeMetaPixelId(metaPixelId)
  const tagId = safeGoogleTagId(googleTagId)
  const gtmId = safeGtmContainerId(gtmContainerId)
  const hasTrackers = Boolean(pixelId || tagId || gtmId)
  const consent = useLandingConsent()
  const canTrack = hasTrackers && consent === "granted"

  React.useEffect(() => {
    captureAttribution()
  }, [])

  return (
    <>
      {canTrack && pixelId ? (
        <Script id="lp-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(pixelId)});fbq('track','PageView');`}
        </Script>
      ) : null}
      {canTrack && tagId ? (
        <>
          <Script
            id="lp-gtag-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`}
            strategy="afterInteractive"
          />
          <Script id="lp-gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',${JSON.stringify(tagId)});`}
          </Script>
        </>
      ) : null}
      {canTrack && gtmId ? (
        <Script id="lp-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtmId)});`}
        </Script>
      ) : null}
      {hasTrackers && consent === "unset" ? (
        <CookieConsentBanner
          privacyHref={privacyHref}
          onAccept={() => saveLandingConsent("granted")}
          onDecline={() => saveLandingConsent("denied")}
        />
      ) : null}
    </>
  )
}

function runSafely(callback: () => void) {
  try {
    callback()
  } catch {
    // Falha de script de terceiro não pode afetar a confirmação do envio.
  }
}

function hasGtmLoaded(dataLayer: unknown[]) {
  return dataLayer.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as Record<string, unknown>).event === "gtm.js"
  )
}

/**
 * Conversão depois de um envio com sucesso, com o MESMO event_id do payload:
 * `Lead` no Meta Pixel (eventID), `generate_lead` no gtag (transaction_id) e
 * `generate_lead` no dataLayer do GTM (event_id). Sem aceite, os scripts não
 * existem e nada é enviado. Nunca envia dados pessoais aos rastreadores.
 */
export function trackLeadConversion({
  eventId,
  interest,
}: {
  eventId: string
  interest?: string | null
}) {
  if (typeof window === "undefined") return

  const trackingWindow = window as TrackingWindow
  const extra = interest ? { lead_interest: interest } : {}

  runSafely(() => trackingWindow.fbq?.("track", "Lead", {}, { eventID: eventId }))
  runSafely(() =>
    trackingWindow.gtag?.("event", "generate_lead", { transaction_id: eventId, ...extra })
  )
  runSafely(() => {
    const dataLayer = trackingWindow.dataLayer

    if (Array.isArray(dataLayer) && hasGtmLoaded(dataLayer)) {
      dataLayer.push({ event: "generate_lead", event_id: eventId, ...extra })
    }
  })
}
