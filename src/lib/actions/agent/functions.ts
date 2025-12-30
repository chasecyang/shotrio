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
    description: "创建分镜（支持单个或批量）。可以指定order插入到特定位置，可以关联图片（首帧、尾帧、关键帧、角色/场景/道具参考等）。适合从剧本生成分镜脚本、补充新镜头等场景。",
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
          description: "分镜数组，每个分镜包含必填字段(shotSize, description)和可选字段(order, cameraMovement, duration, visualPrompt, assets)。\n\n**duration**: 分镜时长，单位为秒。例如：2表示2秒，5表示5秒，2.5表示2.5秒。默认3秒。\n\n**assets**: 关联图片数组，每项包含 assetId（素材ID）和 label（语义化标签）。label 用于 AI 理解图片用途和在 prompt 中引用。\n\nshotSize枚举值: WIDE(远景), FULL(全景), MEDIUM(中景), CLOSE_UP(特写), EXTREME_CLOSE_UP(大特写), EXTREME_LONG_SHOT(大远景)。\n\ncameraMovement枚举值: STATIC(固定), PUSH_IN(推镜头), PULL_OUT(拉镜头), PAN_LEFT(左摇), PAN_RIGHT(右摇), TILT_UP(上摇), TILT_DOWN(下摇), TRACKING(移动跟拍), CRANE_UP(升镜头), CRANE_DOWN(降镜头), ORBIT(环绕), ZOOM_IN(变焦推进), ZOOM_OUT(变焦拉远), HANDHELD(手持)。",
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
    description: `使用 Kling O1 Reference-to-Video API 为分镜生成视频。

⚠️ 重要限制（参数会被自动校验）：
1. **图片总数限制**：elements 和 image_urls 中的图片总数不能超过 7 张
   - elements 中每个角色的 frontal_image_url + reference_image_urls 都计入总数
   - 超过限制会导致校验失败，请减少图片数量

2. **elements 要求**：每个 element 必须包含至少一张 reference_image_urls
   - 如果角色只有一张图片，必须放到 image_urls 中，不要使用 elements
   - 错误示例：elements: [{ frontal_image_url: "xxx.png" }]  // 缺少 reference_image_urls
   - 正确做法：image_urls: ["xxx.png"]

3. **prompt 要求**：必须详细描述镜头运动和画面内容（至少10个字符）
   - 使用英文描述
   - 在描述中自然嵌入 @Element1、@Image1 等占位符引用图片

4. **duration**：只能是字符串 "5" 或 "10"（不是数字）

5. **aspect_ratio**：只能是 "16:9"、"9:16" 或 "1:1"

💡 最佳实践：
- 先用 query_shots 查询分镜的关联素材（shotAssets）
- 根据素材数量合理分配到 elements 和 image_urls
- 多角度的角色用 elements（需要至少2张图），单图场景用 image_urls

## 完整示例
假设 Assets 包含以下图片（共7张）：
- "温室废墟-鸟瞰" (首帧) → image_urls[0]
- "汤姆-正面照" → elements[0].frontal_image_url  
- "汤姆-背面照" → elements[0].reference_image_urls[0]
- "汤姆-侧面照" → elements[0].reference_image_urls[1]
- "魔法石-特写" → elements[1].frontal_image_url
- "魔法石-发光" → elements[1].reference_image_urls[0]
- "温室内部风格参考" → image_urls[1]

生成的配置：
\`\`\`json
{
  "shotId": "shot-123",
  "klingO1Config": {
    "prompt": "Take @Image1 as the start frame. Start with a high-angle satellite view of the ancient greenhouse ruin surrounded by nature. The camera swoops down and flies inside the building, revealing the character from @Element1 standing in the sun-drenched center. The camera then seamlessly transitions into a smooth 180-degree orbit around the character, moving to the back view. As the open backpack comes into focus, the camera continues to push forward, zooming deep inside the bag to reveal the glowing stone from @Element2 nestled inside. Cinematic lighting, hopeful atmosphere, 35mm lens. Make sure to keep it as the style of @Image2.",
    "image_urls": [
      "https://v3b.fal.media/files/b/koala/v9COzzH23FGBYdGLgbK3u.png",
      "https://v3b.fal.media/files/b/elephant/5Is2huKQFSE7A7c5uUeUF.png"
    ],
    "elements": [
      {
        "frontal_image_url": "https://v3b.fal.media/files/b/panda/MQp-ghIqshvMZROKh9lW3.png",
        "reference_image_urls": [
          "https://v3b.fal.media/files/b/kangaroo/YMpmQkYt9xugpOTQyZW0O.png",
          "https://v3b.fal.media/files/b/zebra/d6ywajNyJ6bnpa_xBue-K.png"
        ]
      },
      {
        "frontal_image_url": "https://v3b.fal.media/files/b/koala/gSnsA7HJlgcaTyR5Ujj2H.png",
        "reference_image_urls": [
          "https://v3b.fal.media/files/b/kangaroo/EBF4nWihspyv4pp6hgj7D.png"
        ]
      }
    ],
    "duration": "5",
    "aspect_ratio": "16:9"
  }
}
\`\`\`
`,
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
- prompt: 电影化视频描述（必填，英文，在描述中自然嵌入 @Element1/@Image1 等占位符）
- elements: 角色/物体元素数组（可选，用于角色一致性控制）
  * 每个 element 必须包含 frontal_image_url（正面图）和至少一张 reference_image_urls（多角度参考图）
  * ⚠️ 重要：如果某个角色只有一张图片，不要使用 elements，而是放到 image_urls 中
- image_urls: 首帧/风格/场景/氛围参考图URL数组（可选，第一张通常作为首帧）
- duration: "5" 或 "10"（可选，默认 "5"）
- aspect_ratio: "16:9"/"9:16"/"1:1"（可选，默认 "16:9"）

注意：elements 和 image_urls 中的图片总数最多 7 张`,
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

