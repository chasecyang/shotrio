import { ShotSize, CameraMovement } from "@/types/project";

// 景别枚举映射为中文
export const shotSizeLabels: Record<ShotSize, string> = {
  extreme_long_shot: "大远景",
  long_shot: "远景",
  full_shot: "全景",
  medium_shot: "中景",
  close_up: "特写",
  extreme_close_up: "大特写",
};

// 运镜方式枚举映射为中文
export const cameraMovementLabels: Record<CameraMovement, string> = {
  static: "固定镜头",
  push_in: "推镜头",
  pull_out: "拉镜头",
  pan_left: "左摇",
  pan_right: "右摇",
  tilt_up: "上摇",
  tilt_down: "下摇",
  tracking: "移动跟拍",
  crane_up: "升镜头",
  crane_down: "降镜头",
  orbit: "环绕",
  zoom_in: "变焦推进",
  zoom_out: "变焦拉远",
  handheld: "手持",
};

// 获取景别的中文标签
export function getShotSizeLabel(shotSize: ShotSize): string {
  return shotSizeLabels[shotSize] || shotSize;
}

// 获取运镜方式的中文标签
export function getCameraMovementLabel(movement: CameraMovement): string {
  return cameraMovementLabels[movement] || movement;
}

// 获取所有景别选项
export function getShotSizeOptions(): { value: ShotSize; label: string }[] {
  return Object.entries(shotSizeLabels).map(([value, label]) => ({
    value: value as ShotSize,
    label,
  }));
}

// 获取所有运镜方式选项
export function getCameraMovementOptions(): { value: CameraMovement; label: string }[] {
  return Object.entries(cameraMovementLabels).map(([value, label]) => ({
    value: value as CameraMovement,
    label,
  }));
}

// 格式化时长（毫秒转为秒，简单格式）
export function formatDuration(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  return `${seconds.toFixed(1)}s`;
}

// 格式化时长为 MM:SS 格式
export function formatDurationMMSS(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// 秒转为毫秒
export function secondsToMilliseconds(seconds: number): number {
  return seconds * 1000;
}

// 毫秒转为秒
export function millisecondsToSeconds(milliseconds: number): number {
  return milliseconds / 1000;
}

