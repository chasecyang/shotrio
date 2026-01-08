import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-utils";

interface ProjectsLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function ProjectsLayout({ children }: ProjectsLayoutProps) {
  // 验证用户登录
  const user = await getCurrentUser();
  if (!user) {
    redirect("/?login=true&redirect=/projects");
  }

  return <>{children}</>;
}

