import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail } from "@/lib/actions/project";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { StoryboardSection } from "@/components/projects/storyboard/storyboard-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/layout/project-header";

interface StoryboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function StoryboardPage({ params }: StoryboardPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  return (
    <>
      <ProjectHeader projectId={projectId} pageName="分镜" />
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <Suspense fallback={<StoryboardSkeleton />}>
            <StoryboardWrapper projectId={projectId} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function StoryboardWrapper({ projectId }: { projectId: string }) {
  const project = await getProjectDetail(projectId);

  if (!project) {
    notFound();
  }

  return <StoryboardSection project={project} />;
}

function StoryboardSkeleton() {
  return (
    <div className="flex gap-4 h-full">
      <Skeleton className="h-full w-60" />
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

