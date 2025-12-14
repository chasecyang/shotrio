import { revalidatePath } from "next/cache";

/**
 * 统一的路径重新验证函数
 * 自动处理多语言路径
 * 注意：这些函数不需要 "use server" 指令，因为它们是内部工具函数，不会直接从客户端调用
 */
export function revalidateProjectPath(projectId: string, subPath?: string) {
  const basePath = subPath ? `/projects/${projectId}/${subPath}` : `/projects/${projectId}`;
  
  // 重新验证中文和英文两个版本
  revalidatePath(`/zh${basePath}`);
  revalidatePath(`/en${basePath}`);
  
  // 也重新验证不带语言前缀的路径（用于向后兼容）
  revalidatePath(basePath);
}

/**
 * 重新验证角色页面
 */
export function revalidateCharactersPage(projectId: string) {
  revalidateProjectPath(projectId, "characters");
}

/**
 * 重新验证编辑器页面
 */
export function revalidateEditorPage(projectId: string) {
  revalidateProjectPath(projectId, "editor");
}

/**
 * 重新验证项目列表页面
 */
export function revalidateProjectsList() {
  revalidatePath("/zh/projects");
  revalidatePath("/en/projects");
  revalidatePath("/projects");
}

