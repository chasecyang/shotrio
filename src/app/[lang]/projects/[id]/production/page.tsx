import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail } from "@/lib/actions/project";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/layout/project-header";
import { ProductionTimeline } from "@/components/projects/production/production-timeline";

interface ProductionPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductionPage({ params }: ProductionPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  return (
    <>
      <ProjectHeader projectId={projectId} pageName="成片" />
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<ProductionSkeleton />}>
          <ProductionWrapper projectId={projectId} userId={user.id} />
        </Suspense>
      </div>
    </>
  );
}

async function ProductionWrapper({ projectId, userId }: { projectId: string; userId: string }) {
  const project = await getProjectDetail(projectId);

  if (!project) {
    notFound();
  }

  return <ProductionTimeline project={project} userId={userId} />;
}

function ProductionSkeleton() {
  return (
    <div className="flex h-full bg-background">
      {/* 左侧分镜列表骨架 */}
      <div className="w-64 border-r border-border p-4 space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      
      {/* 中央预览区骨架 */}
      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-border px-4 flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="w-full h-full" />
        </div>
      </div>
      
      {/* 底部时间轴骨架 */}
      <div className="absolute bottom-0 left-0 right-0 h-48 border-t border-border bg-background">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}
