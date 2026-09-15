"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@workspace/ui/lib/utils"

export type PreviewDevice = "desktop" | "mobile"

const DEVICE_WIDTHS: Record<PreviewDevice, number> = {
  desktop: 1280,
  mobile: 390,
}

const PREVIEW_STYLE_ATTR = "data-landing-preview-style"

const SRC_DOC =
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'

function subscribeNoop() {
  return () => {}
}

/** true só no navegador (o iframe é criado no cliente para não perder o onLoad). */
function useIsClient() {
  return React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
}

/**
 * Copia as folhas de estilo do app para o documento do iframe. A página
 * pública não herda o modo escuro do CRM, por isso a classe "dark" fica de fora.
 */
function syncStyles(target: Document) {
  for (const node of target.head.querySelectorAll(`[${PREVIEW_STYLE_ATTR}]`)) {
    node.remove()
  }

  for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
    const clone = node.cloneNode(true) as HTMLElement
    clone.setAttribute(PREVIEW_STYLE_ATTR, "")
    target.head.appendChild(clone)
  }

  const htmlClasses = Array.from(document.documentElement.classList).filter((name) => name !== "dark")
  target.documentElement.className = htmlClasses.join(" ")
  target.documentElement.style.colorScheme = "light"
}

/**
 * Pré-visualização isolada num iframe sem endereço (srcdoc): as media queries
 * do modelo respondem à largura real do "aparelho" e o conteúdo é renderizado
 * via portal, acompanhando o rascunho em tempo real. Não carrega nenhuma rota,
 * então não esbarra no frame-ancestors/X-Frame-Options do app.
 */
export function LandingPreviewFrame({
  device,
  title,
  className,
  children,
}: {
  device: PreviewDevice
  title: string
  className?: string
  children: React.ReactNode
}) {
  const isClient = useIsClient()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [mountNode, setMountNode] = React.useState<HTMLElement | null>(null)
  const [size, setSize] = React.useState({ width: 0, height: 0 })

  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: rect.width, height: rect.height })
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [isClient])

  React.useEffect(() => {
    if (!mountNode) return

    const target = mountNode.ownerDocument
    // Em desenvolvimento o Next injeta/atualiza CSS a qualquer momento.
    const observer = new MutationObserver(() => syncStyles(target))
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [mountNode])

  function handleLoad(event: React.SyntheticEvent<HTMLIFrameElement>) {
    const target = event.currentTarget.contentDocument
    if (!target?.body) return

    syncStyles(target)
    setMountNode(target.body)
  }

  const frameWidth = DEVICE_WIDTHS[device]
  const available = device === "mobile" ? Math.max(0, size.width - 32) : size.width
  const scale = available > 0 ? Math.min(1, available / frameWidth) : 1
  const verticalSpace = device === "mobile" ? Math.max(0, size.height - 32) : size.height
  const frameHeight = verticalSpace > 0 ? verticalSpace / scale : 800

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex size-full min-h-0 justify-center overflow-hidden",
        device === "mobile" && "items-start bg-muted/40 py-4",
        className
      )}
    >
      {isClient && size.width > 0 ? (
        <div
          className={cn(
            "shrink-0 overflow-hidden bg-background",
            device === "mobile" && "rounded-[1.75rem] shadow-lg ring-8 ring-foreground/80"
          )}
          style={{ width: frameWidth * scale, height: frameHeight * scale }}
        >
          <iframe
            key={device}
            title={title}
            srcDoc={SRC_DOC}
            onLoad={handleLoad}
            className="block origin-top-left border-0 bg-white"
            style={{
              width: frameWidth,
              height: frameHeight,
              transform: `scale(${scale})`,
            }}
          />
        </div>
      ) : null}
      {mountNode ? createPortal(children, mountNode) : null}
    </div>
  )
}
