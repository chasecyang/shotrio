import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-utils";

interface ProjectIdLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: string; id: string }>;
}

export default async function ProjectIdLayout({ children }: ProjectIdLayoutProps) {
  // 验证用户登录
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 父级 layout 已经提供了 sidebar，这里只需要渲染子内容
  return <>{children}</>;
}

