"use server";

/**
 * 刷新整个项目数据（从 base.ts 复用）
 */
export async function refreshProject(projectId: string) {
  const { getProjectDetail } = await import("./base");
  return getProjectDetail(projectId);
}

