/**
 * Handler 统一导出和路由映射
 */

import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import { handleQueryFunctions } from "./query";
import { handleGenerationFunctions } from "./generation";
import { handleAudioGeneration } from "./audio-generation";
import { handleTimelineFunctions } from "./timeline";
import { handleAssetOperations } from "./asset-ops";
import { handleTextAssetFunctions } from "./text-asset";

/**
 * 处理器类型
 * - 基础处理器：只需要 projectId
 * - 完整处理器：需要 projectId 和 userId
 */
type BaseHandler = (
  call: FunctionCall,
  projectId: string
) => Promise<FunctionExecutionResult>;

type FullHandler = (
  call: FunctionCall,
  projectId: string,
  userId: string
) => Promise<FunctionExecutionResult>;

type Handler = BaseHandler | FullHandler;

/**
 * 函数名到处理器的映射
 */
const HANDLER_MAP: Record<string, Handler> = {
  // 查询类（基础处理器）
  query_context: handleQueryFunctions,
  query_assets: handleQueryFunctions,
  query_timeline: handleQueryFunctions,
  query_text_assets: handleQueryFunctions,

  // 生成类（完整处理器，需要 userId）
  generate_image_asset: handleGenerationFunctions,
  generate_video_asset: handleGenerationFunctions,

  // 音频生成类（基础处理器）
  generate_sound_effect: handleAudioGeneration,
  generate_bgm: handleAudioGeneration,
  generate_dialogue: handleAudioGeneration,

  // 时间轴操作类（基础处理器）
  add_clip: handleTimelineFunctions,
  remove_clip: handleTimelineFunctions,
  update_clip: handleTimelineFunctions,
  add_audio_track: handleTimelineFunctions,

  // 资产操作类（基础处理器）
  update_asset: handleAssetOperations,
  delete_asset: handleAssetOperations,
  set_project_info: handleAssetOperations,

  // 文本资产类（基础处理器）
  create_text_asset: handleTextAssetFunctions,
};

/**
 * 需要 userId 的函数列表
 */
const FUNCTIONS_REQUIRING_USER_ID = new Set([
  "generate_image_asset",
  "generate_video_asset",
]);

/**
 * 获取处理器
 */
export function getHandler(functionName: string): Handler | undefined {
  return HANDLER_MAP[functionName];
}

/**
 * 检查函数是否需要 userId
 */
export function requiresUserId(functionName: string): boolean {
  return FUNCTIONS_REQUIRING_USER_ID.has(functionName);
}

// 导出所有处理器
export {
  handleQueryFunctions,
  handleGenerationFunctions,
  handleAudioGeneration,
  handleTimelineFunctions,
  handleAssetOperations,
  handleTextAssetFunctions,
};
