import { CameraMovement } from "@/types/project";

/**
 * 根据运镜类型生成Kling Video API的运动提示词
 */
export function generateMotionPrompt(cameraMovement: CameraMovement | null): string {
  const movementMap: Record<CameraMovement, string> = {
    static: "camera stays completely still, subtle character movements only",
    push_in: "smooth camera push in, moving closer to the subject, cinematic dolly shot",
    pull_out: "smooth camera pull back, revealing more of the scene, dolly out movement",
    pan_left: "camera pans left horizontally, smooth tracking motion",
    pan_right: "camera pans right horizontally, smooth tracking motion",
    tilt_up: "camera tilts up vertically, revealing upper part of scene",
    tilt_down: "camera tilts down vertically, looking down at scene",
    tracking: "camera tracks subject movement, following motion smoothly",
    crane_up: "camera cranes up, rising vertically for elevated perspective",
    crane_down: "camera cranes down, descending for lower angle view",
    orbit: "camera orbits around subject in circular motion",
    zoom_in: "camera zooms in, magnifying the subject",
    zoom_out: "camera zooms out, revealing wider view",
    handheld: "dynamic handheld camera movement, slight shake and natural motion",
  };

  return movementMap[cameraMovement || "static"];
}

/**
 * 根据分镜时长确定Kling视频生成时长
 */
export function getKlingDuration(durationMs: number): "5" | "10" {
  const seconds = durationMs / 1000;
  return seconds > 5 ? "10" : "5";
}

/**
 * 生成完整的视频生成prompt
 */
export function buildVideoPrompt(params: {
  visualPrompt?: string;
  cameraMovement: CameraMovement | null;
  additionalMotion?: string;
}): string {
  const { visualPrompt, cameraMovement, additionalMotion } = params;
  
  const parts: string[] = [];
  
  // 运镜描述
  const motionPrompt = generateMotionPrompt(cameraMovement);
  parts.push(motionPrompt);
  
  // 视觉描述（如果有）
  if (visualPrompt) {
    parts.push(visualPrompt);
  }
  
  // 额外运动描述
  if (additionalMotion) {
    parts.push(additionalMotion);
  }
  
  // 添加通用的高质量设置
  parts.push("high quality, cinematic lighting, professional cinematography");
  
  return parts.join(", ");
}
