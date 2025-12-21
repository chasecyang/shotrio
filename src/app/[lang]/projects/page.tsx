import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { createProject, getUserProjects } from "@/lib/actions/project";
import { getTranslations } from "next-intl/server";

export default async function ProjectsPage() {
  // 验证用户登录
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 检查用户是否已有项目
  const projects = await getUserProjects();
  
  if (projects && projects.length > 0) {
    // 用户已有项目，直接跳转到第一个项目的编辑器
    redirect(`/projects/${projects[0].id}/editor`);
  }

  // 用户没有项目，创建一个默认项目
  const t = await getTranslations("projects");
  const defaultTitle = t("defaultProjectTitle") || "我的第一个项目";
  
  const result = await createProject({
    title: defaultTitle,
    description: t("defaultProjectDescription") || undefined,
  });

  if (result.success && result.data) {
    // 创建成功，跳转到新项目的编辑器
    redirect(`/projects/${result.data.id}/editor`);
  }

  // 如果创建失败，也尝试跳转到编辑器（可能是并发创建）
  // 重新获取项目列表
  const retryProjects = await getUserProjects();
  if (retryProjects && retryProjects.length > 0) {
    redirect(`/projects/${retryProjects[0].id}/editor`);
  }

  // 如果还是失败，跳转到登录页
  redirect("/login");
}
