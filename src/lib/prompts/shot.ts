/**
 * 分镜图片生成的 Prompt 构建函数
 * 用于将分镜信息转换为图像生成 prompt
 */

import type { ShotSize, CameraMovement } from "@/types/project";

/**
 * 景别的英文描述映射
 */
const SHOT_SIZE_DESCRIPTIONS: Record<string, string> = {
  extreme_long_shot: "Extreme long shot, wide angle",
  long_shot: "Long shot, wide angle",
  full_shot: "Full shot, showing entire figure",
  medium_shot: "Medium shot, waist up",
  close_up: "Close-up shot, face and shoulders",
  extreme_close_up: "Extreme close-up, detail shot",
};

/**
 * 运镜方式的英文描述映射
 */
const CAMERA_MOVEMENT_DESCRIPTIONS: Record<string, string> = {
  static: "static camera",
  push_in: "push in camera movement, slow zoom in",
  pull_out: "pull out camera movement, slow zoom out",
  pan_left: "pan left camera movement",
  pan_right: "pan right camera movement",
  tilt_up: "tilt up camera movement",
  tilt_down: "tilt down camera movement",
  tracking: "tracking shot, follow the subject",
  crane_up: "crane up movement",
  crane_down: "crane down movement",
  orbit: "orbit camera movement, circular around subject",
  zoom_in: "zoom in",
  zoom_out: "zoom out",
  handheld: "handheld camera, slight shake for realism",
};

/**
 * 构建分镜图片生成的完整 Prompt
 */
export function buildShotImagePrompt(params: {
  shotSize: string;
  cameraMovement: string;
  visualDescription: string;
  sceneName?: string;
  sceneDescription?: string;
  characters: Array<{
    name: string;
    appearance?: string;
    action?: string;
    position?: string;
  }>;
}): string {
  const {
    shotSize,
    cameraMovement,
    visualDescription,
    sceneName,
    sceneDescription,
    characters,
  } = params;

  const parts: string[] = [];

  // 0. 明确说明这是分镜图生成
  parts.push("Cinematic storyboard frame for film production.");

  // 1. 景别和运镜描述
  const shotSizeDesc = SHOT_SIZE_DESCRIPTIONS[shotSize] || "medium shot";
  const cameraMovementDesc =
    CAMERA_MOVEMENT_DESCRIPTIONS[cameraMovement] || "static camera";
  parts.push(`${shotSizeDesc}, ${cameraMovementDesc}.`);

  // 2. 角色信息（如果有）
  if (characters && characters.length > 0) {
    const characterDescs = characters.map((char) => {
      const charParts: string[] = [];
      charParts.push(char.name);

      // 位置描述
      if (char.position) {
        const positionMap: Record<string, string> = {
          left: "on the left",
          center: "in the center",
          right: "on the right",
          foreground: "in the foreground",
          background: "in the background",
        };
        charParts.push(positionMap[char.position] || "");
      }

      // 外貌描述（来自角色基础设定）
      if (char.appearance) {
        charParts.push(char.appearance);
      }

      // 动作描述（来自分镜脚本）
      if (char.action) {
        charParts.push(char.action);
      }

      return charParts.filter(Boolean).join(", ");
    });

    parts.push(characterDescs.join("; ") + ".");
  }

  // 3. 场景信息
  if (sceneName || sceneDescription) {
    const sceneInfo = sceneDescription || sceneName;
    parts.push(`Scene: ${sceneInfo}.`);
  }

  // 4. 画面描述（来自分镜脚本的 visualDescription）
  if (visualDescription) {
    parts.push(visualDescription);
  }

  // 5. 分镜图专业要求
  parts.push(
    "Cinematic storyboard frame for film production"
  );

  return parts.join(" ");
}

/**
 * 构建简化版的 Prompt（当没有完整信息时使用）
 */
export function buildSimpleShotPrompt(params: {
  shotSize: string;
  cameraMovement: string;
  visualDescription: string;
}): string {
  const { shotSize, cameraMovement, visualDescription } = params;

  const shotSizeDesc = SHOT_SIZE_DESCRIPTIONS[shotSize] || "medium shot";
  const cameraMovementDesc =
    CAMERA_MOVEMENT_DESCRIPTIONS[cameraMovement] || "static camera";

  return `Cinematic storyboard frame for film production. ${shotSizeDesc}, ${cameraMovementDesc}. ${visualDescription} Professional film storyboard quality, cinematic composition, 16:9 aspect ratio.`;
}

/**
 * 获取景别的中文名称
 */
export function getShotSizeName(shotSize: ShotSize): string {
  const names: Record<ShotSize, string> = {
    extreme_long_shot: "大远景",
    long_shot: "远景",
    full_shot: "全景",
    medium_shot: "中景",
    close_up: "特写",
    extreme_close_up: "大特写",
  };
  return names[shotSize] || shotSize;
}

/**
 * 获取运镜方式的中文名称
 */
export function getCameraMovementName(movement: CameraMovement): string {
  const names: Record<CameraMovement, string> = {
    static: "固定镜头",
    push_in: "推镜头",
    pull_out: "拉镜头",
    pan_left: "左摇",
    pan_right: "右摇",
    tilt_up: "上摇",
    tilt_down: "下摇",
    tracking: "跟拍",
    crane_up: "升镜头",
    crane_down: "降镜头",
    orbit: "环绕",
    zoom_in: "推焦",
    zoom_out: "拉焦",
    handheld: "手持",
  };
  return names[movement] || movement;
}

