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
  pan: "摇镜",
  tilt: "俯仰",
  zoom_in: "推镜",
  zoom_out: "拉镜",
  dolly: "移动镜头",
  tracking: "跟镜",
  crane: "升降镜头",
  handheld: "手持晃动",
  orbit: "环绕",
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

// 格式化时长（毫秒转为秒）
export function formatDuration(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  return `${seconds}s`;
}

// 秒转为毫秒
export function secondsToMilliseconds(seconds: number): number {
  return seconds * 1000;
}

// 毫秒转为秒
export function millisecondsToSeconds(milliseconds: number): number {
  return milliseconds / 1000;
}

