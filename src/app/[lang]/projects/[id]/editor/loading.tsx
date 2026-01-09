import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header skeleton - 匹配 EditorHeader */}
      <header className="h-14 border-b bg-background/95 flex items-center px-4 gap-4 shrink-0">
        {/* Logo */}
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-px" />
        {/* ProjectSelector */}
        <Skeleton className="h-8 w-40 rounded-md" />
        {/* Settings button */}
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="flex-1" />
        {/* Right side: Credits + Tasks + Theme + User */}
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-6 w-px" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-6 w-px" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </header>

      {/* ModeTabBar skeleton - 居中的标签 */}
      <div className="flex justify-center py-3 shrink-0">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>

      {/* Main content - 匹配 flex-1 flex p-3 gap-3 */}
      <div className="flex-1 flex p-3 gap-3 overflow-hidden">
        {/* Content Panel skeleton - 占满整个区域 (Agent 收起状态) */}
        <div className="flex-1 h-full bg-background/95 border border-border/50 rounded-2xl p-6 space-y-4">
          {/* Asset gallery header */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <div className="flex-1" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          {/* Filter tabs */}
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          {/* Asset grid */}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Agent button skeleton - 右下角悬浮球 */}
      <div className="fixed bottom-6 right-6 z-50">
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
    </div>
  );
}

export default function Loading() {
  return <EditorSkeleton />;
}

