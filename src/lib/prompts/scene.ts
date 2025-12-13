import { Scene } from "@/types/project";

/**
 * 构建全景布局图的 Prompt
 * 用途：建立空间认知，提供"这是哪里"的答案
 * 适用镜头：大远景、远景、全景、片头片尾的环境建立镜头
 * 
 * Master Layout 的核心：展示完整的空间关系、深度层次和地理布局，
 * 为后续所有镜头建立空间参考框架
 * 
 * 注意：这是第一步生成，直接从场景描述生成
 */
export function buildMasterLayoutPrompt(scene: Scene): string {
  const sceneDesc = scene.description || scene.name;
  
  // 将场景描述放到最后，先说明拍摄意图和技术要求
  return `Master shot, ultra wide angle. Complete spatial layout with depth layers. No people. ${sceneDesc}`;
}

/**
 * 构建叙事主力视角的 Prompt（Image-to-Image）
 * 用途：叙事主力，90%的对话和动作镜头都用这个角度
 * 适用镜头：中景、中近景、特写、对话镜头（Over-the-shoulder）
 * 
 * Quarter View 的核心：45度角提供最佳的叙事视角，
 * 既能看清角色表演空间，又能展示环境细节
 * 
 * 注意：这是第二步生成，从全景布局图中聚焦到表演区域
 * 因为已经有参考图片，所以不需要重复场景描述，只需要说明如何转换视角
 */
export function buildQuarterViewPrompt(): string {
  // 不再包含场景描述，因为参考图片已经包含了场景信息
  // 只需要描述如何从全景转换到叙事视角
  return `Three-quarter view, 45-degree angle, medium distance. Zoom in to the main performance area. Show detailed props and furniture. No people.`;
}

/**
 * 获取场景图片类型的中文名称
 */
export function getSceneImageTypeName(type: "master_layout" | "quarter_view"): string {
  return type === "master_layout" ? "全景布局图" : "叙事主力视角";
}

/**
 * 获取场景图片类型的描述
 */
export function getSceneImageTypeDescription(type: "master_layout" | "quarter_view"): string {
  if (type === "master_layout") {
    return "Master Layout - 用于建立空间认知，展示完整场景。适用镜头：大远景、远景、全景";
  }
  return "45° Three-Quarter View - 90%对话和动作镜头的核心视角。适用镜头：中景、中近景、特写";
}

