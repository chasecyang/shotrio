import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { getUserProjects, getProjectDetail, getEpisodeShots } from "@/lib/actions/project-actions";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProjectSidebar } from "@/components/projects/project-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectIdLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: string; id: string }>;
}

export default async function ProjectIdLayout({ children, params }: ProjectIdLayoutProps) {
  // 验证用户登录
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  return (
    <SidebarProvider defaultOpen={true}>
      <Suspense fallback={<SidebarSkeleton />}>
        <ProjectSidebarWrapper projectId={projectId} />
      </Suspense>
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

async function ProjectSidebarWrapper({ projectId }: { projectId: string }) {
  // 获取用户信息
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 获取用户的所有项目
  const projects = await getUserProjects();

  // 获取当前项目详情
  const currentProject = await getProjectDetail(projectId);

  // 计算分镜总数
  let shotCount = 0;
  if (currentProject) {
    for (const episode of currentProject.episodes) {
      const shots = await getEpisodeShots(episode.id);
      shotCount += shots.length;
    }
  }

  return (
    <ProjectSidebar
      projects={projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
      }))}
      currentProject={currentProject ? { ...currentProject, shotCount } : undefined}
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

