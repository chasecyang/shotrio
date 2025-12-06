import { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/auth-utils";
import { Header } from "@/components/layout/header";

export default async function AdminLayout({ 
  children,
}: { 
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  // 验证管理员权限，如果不是管理员会自动重定向
  await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-8">{children}</main>
    </div>
  );
}

