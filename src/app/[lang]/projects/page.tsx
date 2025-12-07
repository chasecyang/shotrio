import { redirect } from "next/navigation";
import { getUserProjects } from "@/lib/actions/project";
import { Film } from "lucide-react";

export default async function ProjectsPage() {
  const projects = await getUserProjects();

  // 如果有项目，自动跳转到第一个项目的剧本页
  if (projects.length > 0) {
    redirect(`/projects/${projects[0].id}/scripts`);
  }

  // 如果没有项目，显示欢迎页面
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Film className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">欢迎使用 Cineqo</h1>
        <p className="text-muted-foreground">
          专业的微短剧创作工具
        </p>
        <p className="text-sm text-muted-foreground">
          点击侧边栏的&ldquo;新建项目&rdquo;开始创作你的第一个短剧项目
        </p>
      </div>
    </div>
  );
}
