import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail } from "@/lib/actions/project";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { ScriptsSection } from "@/components/projects/scripts/scripts-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/layout/project-header";

interface ScriptsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScriptsPage({ params }: ScriptsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  return (
    <>
      <ProjectHeader projectId={projectId} pageName="剧本" />
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <Suspense fallback={<ScriptsSkeleton />}>
            <ScriptsWrapper projectId={projectId} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function ScriptsWrapper({ projectId }: { projectId: string }) {
  const project = await getProjectDetail(projectId);

  if (!project) {
    notFound();
  }

  return <ScriptsSection project={project} />;
}

function ScriptsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

