import { Skeleton } from "@workspace/ui/components/skeleton"

const COLUMN_CARDS = [3, 2, 2, 1, 1]

export default function LeadsLoading() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row">
        <Skeleton className="h-8 w-full lg:w-48" />
        <Skeleton className="h-8 w-full lg:w-44" />
        <Skeleton className="h-8 w-full lg:w-44" />
        <Skeleton className="h-8 w-full lg:ms-auto lg:w-44" />
      </div>

      <div className="flex gap-3 overflow-hidden">
        {COLUMN_CARDS.map((cards, column) => (
          <div
            key={column}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2"
          >
            <Skeleton className="h-7 w-32" />
            {Array.from({ length: cards }, (_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
