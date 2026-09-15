import { Skeleton } from "@workspace/ui/components/skeleton"

export function ClientFormSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex w-full max-w-4xl flex-col gap-6">
        <Skeleton className="h-8 w-72" />
        {Array.from({ length: 4 }, (_, section) => (
          <div key={section} className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ClientDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-8 w-full max-w-2xl" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </div>
  )
}
