import { Suspense } from "react";
import { getProjectDetail } from "@/lib/actions/project";
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
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectHeaderProps {
  projectId: string;
  pageName: string;
}

export function ProjectHeader({ projectId, pageName }: ProjectHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Suspense fallback={<Skeleton className="h-5 w-48" />}>
          <ProjectBreadcrumb projectId={projectId} pageName={pageName} />
        </Suspense>
      </div>
    </header>
  );
}

async function ProjectBreadcrumb({ 
  projectId, 
  pageName 
}: { 
  projectId: string; 
  pageName: string;
}) {
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
          <BreadcrumbPage>{pageName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
