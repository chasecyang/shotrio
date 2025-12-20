import { CameraMovement } from "@/types/project";

/**
 * 运镜类型的中文描述映射
 */
const cameraMovementCN: Record<CameraMovement, string> = {
  static: "固定镜头",
  push_in: "推镜头",
  pull_out: "拉镜头",
  pan_left: "左摇镜头",
  pan_right: "右摇镜头",
  tilt_up: "上摇镜头",
  tilt_down: "下摇镜头",
  tracking: "跟拍镜头",
  crane_up: "升镜头",
  crane_down: "降镜头",
  orbit: "环绕镜头",
  zoom_in: "推焦",
  zoom_out: "拉焦",
  handheld: "手持镜头",
};

/**
 * 运镜类型的英文描述映射
 */
const cameraMovementEN: Record<CameraMovement, string> = {
  static: "static camera",
  push_in: "push in",
  pull_out: "pull out",
  pan_left: "pan left",
  pan_right: "pan right",
  tilt_up: "tilt up",
  tilt_down: "tilt down",
  tracking: "tracking shot",
  crane_up: "crane up",
  crane_down: "crane down",
  orbit: "orbit",
  zoom_in: "zoom in",
  zoom_out: "zoom out",
  handheld: "handheld",
};

/**
 * 根据运镜类型生成Kling Video API的运动提示词
 * @param cameraMovement 运镜类型
 * @param isChinese 是否使用中文
 */
export function generateMotionPrompt(
  cameraMovement: CameraMovement | null, 
  isChinese: boolean = false
): string {
  const movementMap = isChinese ? cameraMovementCN : cameraMovementEN;
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
 * 优化版本：更适合Kling视频生成
 */
export function buildVideoPrompt(params: {
  description?: string;  // 描述（中文）
  visualPrompt?: string;       // 视觉提示词（英文）
  cameraMovement: CameraMovement | null;
}): string {
  const { description, visualPrompt, cameraMovement } = params;
  
  const parts: string[] = [];
  
  // 判断是使用中文还是英文prompt
  const isChinesePrompt = !!description;
  
  // 1. 运镜描述（根据语言调整）
  const motionPrompt = generateMotionPrompt(cameraMovement, isChinesePrompt);
  parts.push(motionPrompt);
  
  // 2. 画面描述（优先使用中文描述，其次是英文prompt）
  if (description) {
    parts.push(description);
  } else if (visualPrompt) {
    parts.push(visualPrompt);
  }
  
  // 使用句号或逗号连接各部分
  return isChinesePrompt 
    ? parts.join("。") 
    : parts.join(". ");
}
