import { Skeleton } from "@workspace/ui/components/skeleton"

export default function LeadLoading() {
  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
