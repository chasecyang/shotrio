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

  return `${shotSizeDesc}, ${cameraMovementDesc}. ${visualDescription} Professional film storyboard quality.`;
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

/**
 * 构建分镜拆解的AI Prompt
 * 使用DeepSeek AI分析分镜内容，识别自然的拆分点
 */
export function buildShotDecompositionPrompt(params: {
  shotSize: string;
  cameraMovement: string;
  visualDescription: string;
  duration: number;
  characters: Array<{ 
    id: string;
    name: string; 
    appearance?: string;
  }>;
  dialogues: Array<{ 
    characterId?: string;
    characterName?: string; 
    text: string; 
    order: number;
  }>;
  sceneName?: string;
  sceneDescription?: string;
  sceneId?: string;
}): string {
  const {
    shotSize,
    cameraMovement,
    visualDescription,
    duration,
    characters,
    dialogues,
    sceneName,
    sceneDescription,
    sceneId,
  } = params;

  const shotSizeDesc = SHOT_SIZE_DESCRIPTIONS[shotSize] || shotSize;
  const cameraMovementDesc = CAMERA_MOVEMENT_DESCRIPTIONS[cameraMovement] || cameraMovement;

  // 构建角色信息
  const characterInfo = characters.map(char => 
    `- ${char.name} (ID: ${char.id})${char.appearance ? `: ${char.appearance}` : ''}`
  ).join('\n');

  // 构建对话信息
  const dialogueInfo = dialogues.map((d, idx) => 
    `${idx + 1}. ${d.characterName || '旁白'}: "${d.text}"`
  ).join('\n');

  return `你是一位专业的电影分镜师，需要将一个包含多个对话或动作的复杂分镜拆解成多个独立的小分镜，使每个分镜更加聚焦和易于制作。

## 原分镜信息

**景别**: ${getShotSizeName(shotSize as ShotSize)} (${shotSizeDesc})
**运镜**: ${getCameraMovementName(cameraMovement as CameraMovement)} (${cameraMovementDesc})
**时长**: ${duration}ms (${(duration / 1000).toFixed(1)}秒)
**场景**: ${sceneName || '未指定'}${sceneId ? ` (ID: ${sceneId})` : ''}
${sceneDescription ? `**场景描述**: ${sceneDescription}` : ''}
**视觉描述**: ${visualDescription}

**角色列表**:
${characterInfo || '无角色'}

**对话内容** (共${dialogues.length}句):
${dialogueInfo || '无对话'}

## 拆解任务

请分析这个分镜，识别自然的拆分点，将其拆解为多个子分镜。拆分时考虑以下因素：

1. **对话主体变化**: 不同角色说话时，可以考虑使用正反打镜头（交替的中景或特写）
2. **情绪转折**: 对话中的情绪变化（如平静→愤怒）可能需要景别调整
3. **动作变化**: 视觉描述中提到的显著动作变化（如坐→站）
4. **时间跨度**: 描述中暗示的时间流逝
5. **镜头语言**: 根据对话内容推荐合适的景别和运镜方式

## 输出要求

请以JSON格式返回拆解方案，包含以下字段：

\`\`\`json
{
  "reasoning": "你的拆解思路和理由（2-3句话说明为什么这样拆分）",
  "decomposedShots": [
    {
      "order": 1,
      "shotSize": "medium_shot",
      "cameraMovement": "static",
      "duration": 3000,
      "visualDescription": "这个子分镜的视觉描述",
      "visualPrompt": "英文的图像生成prompt",
      "audioPrompt": "音效提示（可选）",
      "characters": [
        {
          "characterId": "角色ID",
          "position": "center|left|right|foreground|background",
          "action": "该角色在此分镜中的动作"
        }
      ],
      "dialogues": [
        {
          "characterId": "角色ID（旁白可为null）",
          "dialogueText": "对话内容",
          "emotionTag": "neutral|happy|sad|angry|surprised|fearful",
          "order": 1
        }
      ]
    }
  ]
}
\`\`\`

**重要规则**:
- 每个子分镜应该有明确的视觉焦点
- 对话场景建议使用中景(medium_shot)或特写(close_up)
- 人物切换时考虑使用正反打
- 动作幅度大的场景使用全景(full_shot)或远景(long_shot)
- 情绪高潮使用特写(close_up)或大特写(extreme_close_up)
- 每个对话的时长根据文字内容估算（约每秒3-4个汉字）
- 继承原分镜的场景ID（sceneId: ${sceneId || 'null'}）
- visualPrompt必须是英文
- 确保所有对话都被分配到子分镜中
- 子分镜的总时长应该接近或略大于原分镜时长

请返回纯JSON，不要包含markdown代码块标记。`;
}

