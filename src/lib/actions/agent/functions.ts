/**
 * Agent Function 工具定义
 * 
 * 精简版设计原则：
 * 1. 合并批量操作 - 单个function通过数组参数支持批量
 * 2. 统一参数类型 - 使用正确的JSON Schema类型
 * 3. 简化枚举 - 只保留最常用的值
 * 4. 职责清晰 - 每个function只做一件事
 */

import type { FunctionDefinition } from "@/types/agent";

/**
 * 所有可用的 Function 工具
 */
export const AGENT_FUNCTIONS: FunctionDefinition[] = [
  // ============================================
  // 查询类工具（只读，直接执行）- 4个
  // ============================================
  {
    name: "query_context",
    description: "查询项目完整上下文，包括剧本内容、分镜列表、素材统计、可用美术风格等。这是一个综合查询工具，适合在对话开始时了解项目全貌。",
    displayName: "查询项目上下文",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID（可选）。如果提供，会包含该剧集的剧本内容和分镜列表",
        },
        includeAssets: {
          type: "boolean",
          description: "是否包含素材库信息，默认true",
        },
        includeArtStyles: {
          type: "boolean",
          description: "是否包含可用美术风格列表，默认true",
        },
      },
    },
    category: "read",
    needsConfirmation: false,
  },
  {
    name: "query_assets",
    description: "查询项目素材库。支持按标签精确筛选角色、场景、道具等。适合在需要引用现有素材时使用。",
    displayName: "查询素材库",
    parameters: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          description: "标签筛选数组，如 ['角色','男性'] 或 ['场景','室外']",
        },
        limit: {
          type: "number",
          description: "返回数量限制，默认20",
        },
      },
    },
    category: "read",
    needsConfirmation: false,
  },
  {
    name: "query_shots",
    description: "查询指定剧集的分镜详情。返回完整的分镜信息，包括描述、景别、运镜、时长、关联的素材（shotAssets）等。shotAssets 包含 label 和 imageUrl，用于视频生成时引用。",
    displayName: "查询分镜详情",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID",
        },
        shotIds: {
          type: "array",
          description: "可选：指定分镜ID数组，只查询这些分镜。如果不提供则返回所有分镜",
        },
      },
      required: ["episodeId"],
    },
    category: "read",
    needsConfirmation: false,
  },

  // ============================================
  // 创作类工具（生成/创建，需要确认）- 3个
  // ============================================
  {
    name: "create_shots",
    description: "创建分镜（支持单个或批量）。可以指定order插入到特定位置，可以关联图片（首帧、尾帧、关键帧、角色/场景/道具参考等）并提供建议的生成配置。适合从剧本生成分镜脚本、补充新镜头等场景。",
    displayName: "创建分镜",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID",
        },
        shots: {
          type: "array",
          description: "分镜数组，每个分镜包含必填字段(shotSize, description)和可选字段(order, cameraMovement, duration, visualPrompt, assets, suggestedConfig)。\n\n**duration**: 分镜时长，单位为秒。例如：2表示2秒，5表示5秒，2.5表示2.5秒。默认3秒。\n\n**assets**: 关联图片数组，每项包含 assetId（素材ID）和 label（语义化标签）。label 用于 AI 理解图片用途和在 prompt 中引用。\n\n**suggestedConfig**: 建议的视频生成配置，包含 prompt（包含 @label 占位符）和 duration（\"5\" 或 \"10\"）。\n\nshotSize枚举值: WIDE(远景), FULL(全景), MEDIUM(中景), CLOSE_UP(特写), EXTREME_CLOSE_UP(大特写), EXTREME_LONG_SHOT(大远景)。\n\ncameraMovement枚举值: STATIC(固定), PUSH_IN(推镜头), PULL_OUT(拉镜头), PAN_LEFT(左摇), PAN_RIGHT(右摇), TILT_UP(上摇), TILT_DOWN(下摇), TRACKING(移动跟拍), CRANE_UP(升镜头), CRANE_DOWN(降镜头), ORBIT(环绕), ZOOM_IN(变焦推进), ZOOM_OUT(变焦拉远), HANDHELD(手持)。",
        },
      },
      required: ["episodeId", "shots"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "generate_assets",
    description: "生成素材图片（支持单个或批量）。可以是从零生成，也可以基于现有素材进行图生图。适合创建角色、场景、道具等视觉素材。",
    displayName: "生成素材",
    parameters: {
      type: "object",
      properties: {
        assets: {
          type: "array",
          description: "素材数组，每个素材包含: prompt（必填，英文描述，用完整句子）、name（可选）、tags（可选，字符串数组）、sourceAssetIds（可选，用于图生图）",
        },
      },
      required: ["assets"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "generate_shot_video",
    description: `使用 Kling O1 Reference-to-Video API 为分镜生成视频。需要提供完整的视频生成参数。

**Kling O1 参数结构说明：**

1. **prompt**（必填）：详细的运动描述。可以使用 @Element1, @Image1 等引用图片。

2. **elements**（可选）：角色/物体元素数组，用于保持角色一致性。
   每个元素包含：
   - frontal_image_url: 主图URL（如角色正面图）
   - reference_image_urls: 参考图URL数组（如侧面、动作等）
   
   在 prompt 中使用 @Element1, @Element2 引用这些元素。

3. **image_urls**（可选）：参考图URL数组，用于：
   - 起始帧：放在第一位，在 prompt 中用 @Image1 引用（如 "Take @Image1 as the start frame..."）
   - 风格/场景参考：其他位置，用 @Image2, @Image3 等引用
   
   注意：elements + image_urls 总数最多 7 张图片

4. **duration**（可选）："5" 或 "10"，默认 "5"

5. **aspect_ratio**（可选）："16:9", "9:16" 或 "1:1"，默认 "16:9"

**使用建议：**
- 先用 query_shots 查询分镜关联的素材，获取 imageUrl 和 label
- 根据 label 的语义，将图片分类为 elements 或 image_urls
- 如果有起始帧，将其放在 image_urls 的第一位
- 在 prompt 中使用对应的引用占位符`,
    displayName: "生成分镜视频",
    parameters: {
      type: "object",
      properties: {
        shotId: {
          type: "string",
          description: "分镜ID",
        },
        klingO1Config: {
          type: "object",
          description: `Kling O1 API 完整配置。包含：
- prompt: 运动描述（必填）
- elements: 角色元素数组（可选）
- image_urls: 参考图URL数组（可选，起始帧放第一位）
- duration: "5" 或 "10"（可选）
- aspect_ratio: "16:9"/"9:16"/"1:1"（可选）

注意：elements + image_urls 总数最多 7 张图片`,
        },
      },
      required: ["shotId", "klingO1Config"],
    },
    category: "generation",
    needsConfirmation: true,
  },

  // ============================================
  // 修改类工具（需要确认）- 4个
  // ============================================
  {
    name: "update_episode",
    description: "修改剧集信息，包括标题、梗概、剧本内容。可以完整替换剧本或基于现有内容进行修改。建议先用query_context获取当前内容。",
    displayName: "修改剧集",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID",
        },
        title: {
          type: "string",
          description: "剧集标题（可选）",
        },
        summary: {
          type: "string",
          description: "剧集梗概（可选，50字以内）",
        },
        scriptContent: {
          type: "string",
          description: "完整剧本内容（可选）。如需修改剧本，建议先query_context获取当前内容，然后生成新版本",
        },
      },
      required: ["episodeId"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "update_shots",
    description: "修改分镜属性（支持单个或批量）。可以修改时长、景别、运镜、描述、视觉提示词。",
    displayName: "修改分镜",
    parameters: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          description: "更新数组，每项包含 shotId（必填）和要修改的字段（duration, shotSize, cameraMovement, description, visualPrompt）。\n\n**duration**: 分镜时长，单位为秒。例如：2表示2秒，5表示5秒，2.5表示2.5秒。\n\nshotSize枚举值: WIDE(远景), FULL(全景), MEDIUM(中景), CLOSE_UP(特写), EXTREME_CLOSE_UP(大特写), EXTREME_LONG_SHOT(大远景)。\n\ncameraMovement枚举值: STATIC(固定), PUSH_IN(推镜头), PULL_OUT(拉镜头), PAN_LEFT(左摇), PAN_RIGHT(右摇), TILT_UP(上摇), TILT_DOWN(下摇), TRACKING(移动跟拍), CRANE_UP(升镜头), CRANE_DOWN(降镜头), ORBIT(环绕), ZOOM_IN(变焦推进), ZOOM_OUT(变焦拉远), HANDHELD(手持)。",
        },
      },
      required: ["updates"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "update_assets",
    description: "修改素材信息（支持单个或批量）。可以修改名称和标签。",
    displayName: "修改素材",
    parameters: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          description: "更新数组，每项包含 assetId（必填）和要修改的字段（name, tags）",
        },
      },
      required: ["updates"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "set_art_style",
    description: "为项目设置美术风格。风格会影响所有后续图像生成的整体外观和氛围。先用 query_context 获取可用风格列表。",
    displayName: "设置美术风格",
    parameters: {
      type: "object",
      properties: {
        styleId: {
          type: "string",
          description: "风格ID",
        },
      },
      required: ["styleId"],
    },
    category: "modification",
    needsConfirmation: true,
  },

  // ============================================
  // 删除类工具（需要确认）- 2个
  // ============================================
  {
    name: "delete_shots",
    description: "删除分镜（支持单个或批量）。删除后无法恢复，请谨慎使用。",
    displayName: "删除分镜",
    parameters: {
      type: "object",
      properties: {
        shotIds: {
          type: "array",
          description: "要删除的分镜ID数组",
        },
      },
      required: ["shotIds"],
    },
    category: "deletion",
    needsConfirmation: true,
  },
  {
    name: "delete_assets",
    description: "删除素材（支持单个或批量）。如果素材已被分镜使用，需要先解除关联。删除后无法恢复。",
    displayName: "删除素材",
    parameters: {
      type: "object",
      properties: {
        assetIds: {
          type: "array",
          description: "要删除的素材ID数组",
        },
      },
      required: ["assetIds"],
    },
    category: "deletion",
    needsConfirmation: true,
  },
];

/**
 * 根据名称获取 Function 定义
 */
export function getFunctionDefinition(name: string): FunctionDefinition | undefined {
  return AGENT_FUNCTIONS.find((f) => f.name === name);
}

