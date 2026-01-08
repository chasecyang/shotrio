import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { getUserProjects } from "@/lib/actions/project";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/?login=true&redirect=/projects");
  }

  const projects = await getUserProjects();

  if (projects && projects.length > 0) {
    redirect(`/projects/${projects[0].id}/editor`);
  }

  // 没有项目，回到首页让用户通过输入框创建
  redirect("/");
}
