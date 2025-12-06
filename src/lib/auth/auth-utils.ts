import { auth } from "../auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@/lib/db/schemas/auth";

/**
 * 获取当前会话用户
 */
export async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user || null;
}

/**
 * 验证是否为管理员
 * 如果未登录，重定向到登录页
 * 如果不是管理员，重定向到首页
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }
  
  if (user.role !== Role.ADMIN) {
    redirect("/");
  }
  
  return user;
}

/**
 * 验证是否已登录
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }
  
  return user;
}


/**
 * 验证当前用户是否有权访问指定的用户数据
 * 只有本人或管理员可以访问
 * @throws Error 如果未登录或无权访问
 */
export async function requireUserAccess(targetUserId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  // 管理员可以访问所有用户数据
  if (session.user.role === Role.ADMIN) {
    return session.user;
  }

  // 普通用户只能访问自己的数据
  if (session.user.id !== targetUserId) {
    throw new Error("无权访问此用户数据");
  }

  return session.user;
}

