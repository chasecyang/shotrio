import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail } from "@/lib/actions/project";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { ScenesSection } from "@/components/projects/scenes/scenes-section";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BackgroundTasks } from "@/components/projects/layout/background-tasks";

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
      <header className="flex h-16 shrink-0 items-center gap-2 justify-between">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Suspense fallback={<Skeleton className="h-5 w-48" />}>
            <ProjectBreadcrumb projectId={projectId} />
          </Suspense>
        </div>
        <div className="px-4">
          <BackgroundTasks />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Suspense fallback={<ScenesSkeleton />}>
          <ScenesWrapper projectId={projectId} />
        </Suspense>
      </div>
    </>
  );
}

async function ProjectBreadcrumb({ projectId }: { projectId: string }) {
  const project = await getProjectDetail(projectId);
  
  if (!project) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/projects">{project.title}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>场景管理</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
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
