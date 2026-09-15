import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

export default function ImobiliariaLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex w-full max-w-4xl flex-col gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((field) => (
              <div key={field} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-72" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-8 w-full" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
