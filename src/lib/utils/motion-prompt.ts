/**
 * 视频运动提示词工具
 * 用于辅助视频生成的运动描述
 * 注意：分镜概念已移除，这些函数主要用于视频生成的参考
 */

/**
 * 常见运镜类型的中文描述
 */
export const CAMERA_MOVEMENTS_CN = {
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
} as const;

/**
 * 常见运镜类型的英文描述
 */
export const CAMERA_MOVEMENTS_EN = {
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
} as const;

/**
 * 根据时长确定Kling视频生成时长
 */
export function getKlingDuration(durationSeconds: number): "5" | "10" {
  return durationSeconds > 5 ? "10" : "5";
}
