/**
 * Actions 通用工具函数
 * 
 * 这个模块提供了一系列可复用的工具函数，用于减少 actions 中的重复代码
 */

// 权限验证
export {
  requireAuth,
  requireProjectAccess,
  requireAuthAndProject,
} from "./auth";

// 任务创建
export {
  createImageGenerationTask,
} from "./task";

// 错误处理
export {
  withErrorHandling,
  wrapAction,
} from "./error-handler";

// 路径重新验证
export {
  revalidateProjectPath,
  revalidateCharactersPage,
  revalidateEditorPage,
  revalidateProjectsList,
} from "./revalidate";

