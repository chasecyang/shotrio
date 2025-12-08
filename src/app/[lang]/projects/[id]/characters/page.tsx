import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail } from "@/lib/actions/project";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { CharactersSection } from "@/components/projects/characters/characters-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/layout/project-header";

interface CharactersPageProps {
  params: Promise<{ id: string }>;
}

export default async function CharactersPage({ params }: CharactersPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  return (
    <>
      <ProjectHeader projectId={projectId} pageName="角色管理" />
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <Suspense fallback={<CharactersSkeleton />}>
            <CharactersWrapper projectId={projectId} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function CharactersWrapper({ projectId }: { projectId: string }) {
  const project = await getProjectDetail(projectId);

  if (!project) {
    notFound();
  }

  return <CharactersSection project={project} />;
}

function CharactersSkeleton() {
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

