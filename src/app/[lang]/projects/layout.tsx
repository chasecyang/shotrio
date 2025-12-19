import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { getUserProjects } from "@/lib/actions/project";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProjectSidebar } from "@/components/projects/layout/project-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectsLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function ProjectsLayout({ children }: ProjectsLayoutProps) {
  // 验证用户登录
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Suspense fallback={<SidebarSkeleton />}>
        <ProjectSidebarWrapper />
      </Suspense>
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

async function ProjectSidebarWrapper() {
  // 获取用户信息
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 获取用户的所有项目
  const projects = await getUserProjects();

  return (
    <ProjectSidebar
      projects={projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
      }))}
      currentProject={undefined}
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      }}
    />
  );
}

function SidebarSkeleton() {
  return (
    <div className="w-64 border-r border-border bg-card p-4 space-y-4">
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

