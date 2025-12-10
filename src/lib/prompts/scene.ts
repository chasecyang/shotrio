import { Scene } from "@/types/project";

/**
 * 构建 Master Layout 全景布局图的 Prompt
 * 用途：建立空间认知，提供"这是哪里"的答案
 * 适用镜头：大远景、远景、全景、片头片尾的环境建立镜头
 */
export function buildMasterLayoutPrompt(scene: Scene): string {
  const sceneDesc = scene.description || scene.name;
  
  return `Wide establishing shot, eye level view (Eye Level +10°), full scene layout,
clear depth layers, architecture visible, NO people,
cinematic background plate, 16:9 aspect ratio.

Scene: ${scene.name}
Description: ${sceneDesc}

Professional film production design, highly detailed environment, 
atmospheric lighting, masterpiece quality, 8k, cinematic composition,
foreground middle ground background clearly defined.`;
}

/**
 * 构建 45° Three-Quarter View 叙事主力视角的 Prompt
 * 用途：叙事主力，90%的对话和动作镜头都用这个角度
 * 适用镜头：中景、中近景、特写、对话镜头（Over-the-shoulder）
 */
export function buildQuarterViewPrompt(scene: Scene): string {
  const sceneDesc = scene.description || scene.name;
  
  return `45 degree three-quarter view, eye level camera,
medium distance, focus on main activity area,
character staging area visible, NO people,
detailed props and furniture, 16:9 aspect ratio.

Scene: ${scene.name}
Description: ${sceneDesc}

Interior/exterior space design for narrative scenes,
cinematic lighting, highly detailed, 8k, masterpiece quality,
clear character positioning space, realistic textures and materials.`;
}

/**
 * 获取场景图片类型的中文名称
 */
export function getSceneImageTypeName(type: "master_layout" | "quarter_view"): string {
  return type === "master_layout" ? "Master Layout 全景布局图" : "45° View 叙事主力视角";
}

/**
 * 获取场景图片类型的描述
 */
export function getSceneImageTypeDescription(type: "master_layout" | "quarter_view"): string {
  if (type === "master_layout") {
    return "用于建立空间认知，展示完整场景。适用镜头：大远景、远景、全景";
  }
  return "90%对话和动作镜头的核心视角。适用镜头：中景、中近景、特写";
}

