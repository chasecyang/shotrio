import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail } from "@/lib/actions/project";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { ProjectSettingsForm } from "@/components/projects/settings/project-settings-form";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/layout/project-header";

interface SettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  return (
    <>
      <ProjectHeader projectId={projectId} pageName="项目设置" />
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <Suspense fallback={<SettingsSkeleton />}>
            <SettingsWrapper projectId={projectId} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function SettingsWrapper({ projectId }: { projectId: string }) {
  const project = await getProjectDetail(projectId);

  if (!project) {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <ProjectSettingsForm project={project} />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="max-w-3xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

