import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageShell } from "@/components/shared/page-shell"

function HeadingSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {withAction ? <Skeleton className="h-8 w-40" /> : null}
    </div>
  )
}

/** Lista de landing pages. */
export function LandingListSkeleton() {
  return (
    <PageShell aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <HeadingSkeleton withAction />
      <Skeleton className="h-8 w-56" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </PageShell>
  )
}

/** Galeria de modelos. */
export function TemplateGallerySkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-8 p-4 lg:p-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <HeadingSkeleton />
      {Array.from({ length: 2 }, (_, group) => (
        <div key={group} className="flex flex-col gap-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex flex-col gap-3">
                <Skeleton className="aspect-4/3 w-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-40" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Editor em duas colunas. */
export function LandingEditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
        <Skeleton className="hidden min-h-[36rem] w-full lg:block" />
      </div>
    </div>
  )
}

/** Pré-visualização em tela cheia. */
export function LandingPreviewSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-9 w-full rounded-none" />
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-[28rem] w-full" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}
