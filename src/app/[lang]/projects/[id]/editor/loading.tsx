import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header skeleton */}
      <div className="h-14 border-b bg-background flex items-center px-4 gap-4 shrink-0">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-8 w-px mx-2" />
        <Skeleton className="h-8 w-40" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Top section */}
        <div className="flex-1 flex min-h-0" style={{ height: "60%" }}>
          {/* Resource panel */}
          <div className="w-1/4 border-r bg-card p-4 space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>

          {/* Preview panel */}
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full max-w-2xl" />
            <div className="grid grid-cols-2 gap-4 max-w-2xl">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>

        {/* Timeline section */}
        <div className="bg-[#0a0a0b] border-t" style={{ height: "40%" }}>
          {/* Toolbar */}
          <div className="h-10 border-b border-white/10 flex items-center px-4 gap-4">
            <Skeleton className="h-6 w-32 bg-white/10" />
            <div className="flex-1" />
            <Skeleton className="h-6 w-24 bg-white/10" />
          </div>

          {/* Ruler */}
          <div className="h-8 border-b border-white/10 flex items-center px-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-12 bg-white/10 mr-8" />
            ))}
          </div>

          {/* Track */}
          <div className="h-24 p-2 flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-full w-32 rounded-md bg-white/10"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return <EditorSkeleton />;
}

