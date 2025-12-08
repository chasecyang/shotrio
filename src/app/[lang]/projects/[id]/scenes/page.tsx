import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail } from "@/lib/actions/project";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { ScenesSection } from "@/components/projects/scenes/scenes-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/layout/project-header";

interface ScenesPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScenesPage({ params }: ScenesPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  return (
    <>
      <ProjectHeader projectId={projectId} pageName="场景管理" />
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <Suspense fallback={<ScenesSkeleton />}>
            <ScenesWrapper projectId={projectId} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function ScenesWrapper({ projectId }: { projectId: string }) {
  const project = await getProjectDetail(projectId);

  if (!project) {
    notFound();
  }

  return <ScenesSection project={project} />;
}

function ScenesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
