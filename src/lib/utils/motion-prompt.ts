import { CameraMovement, EmotionTag } from "@/types/project";

/**
 * 情绪标签的英文描述映射
 */
const emotionDescriptions: Record<EmotionTag, string> = {
  neutral: "neutral",
  happy: "happily",
  sad: "sadly",
  angry: "angrily",
  surprised: "surprised",
  fearful: "fearfully",
  disgusted: "disgustedly",
};

/**
 * 根据运镜类型生成Kling Video API的运动提示词（简化版）
 */
export function generateMotionPrompt(cameraMovement: CameraMovement | null): string {
  const movementMap: Record<CameraMovement, string> = {
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
  visualDescription?: string;  // 画面描述（中文）
  visualPrompt?: string;       // 视觉提示词（英文）
  cameraMovement: CameraMovement | null;
  dialogues?: Array<{          // 对话内容
    characterName?: string;
    dialogueText: string;
    emotionTag?: EmotionTag | null;  // 情绪标签
  }>;
}): string {
  const { visualDescription, visualPrompt, cameraMovement, dialogues } = params;
  
  const parts: string[] = [];
  
  // 1. 运镜描述（简化）
  const motionPrompt = generateMotionPrompt(cameraMovement);
  parts.push(motionPrompt);
  
  // 2. 画面描述（优先使用中文描述，其次是英文prompt）
  if (visualDescription) {
    parts.push(visualDescription);
  } else if (visualPrompt) {
    parts.push(visualPrompt);
  }
  
  // 3. 对话内容（包含情绪）
  if (dialogues && dialogues.length > 0) {
    const dialogueText = dialogues
      .map(d => {
        const emotion = d.emotionTag ? emotionDescriptions[d.emotionTag] : null;
        
        if (d.characterName) {
          // 有角色名和情绪
          if (emotion && emotion !== "neutral") {
            return `${d.characterName} says ${emotion}: "${d.dialogueText}"`;
          }
          // 只有角色名
          return `${d.characterName}: "${d.dialogueText}"`;
        }
        
        // 旁白，包含情绪
        if (emotion && emotion !== "neutral") {
          return `${emotion}: "${d.dialogueText}"`;
        }
        
        // 普通旁白
        return `"${d.dialogueText}"`;
      })
      .join(", ");
    parts.push(dialogueText);
  }
  
  return parts.join(", ");
}
