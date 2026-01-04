/**
 * Agent Function 工具定义
 * 
 */

import type { FunctionDefinition } from "@/types/agent";

/**
 * 所有可用的 Function 工具
 */
export const AGENT_FUNCTIONS: FunctionDefinition[] = [
  // ============================================
  // 查询类工具（只读，直接执行）
  // ============================================
  {
    name: "query_context",
    description: "查询项目完整上下文，包括视频列表、素材统计、可用美术风格等。这是一个综合查询工具，适合在对话开始时了解项目全貌。",
    displayName: "查询项目上下文",
    parameters: {
      type: "object",
      properties: {
        includeAssets: {
          type: "boolean",
          description: "是否包含素材库信息，默认true",
        },
        includeVideos: {
          type: "boolean",
          description: "是否包含视频列表，默认true",
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
    description: "查询项目资产库（包括图片素材和视频素材）。支持按类型（image/video）和标签筛选。返回资产的详细信息，包括ID、名称、状态、URL、prompt、标签等。适合在需要引用现有素材、查看生成结果、或了解资产库内容时使用。",
    displayName: "查询资产库",
    parameters: {
      type: "object",
      properties: {
        assetType: {
          type: "string",
          description: "资产类型筛选：'image'（图片素材）或 'video'（视频素材）。不提供则返回所有类型",
        },
        tags: {
          type: "array",
          description: "标签筛选数组，如 ['角色','男性'] 或 ['场景','室外']。可同时筛选多个标签",
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

  // ============================================
  // 创作类工具（生成/创建，需要确认）
  // ============================================
  {
    name: "generate_image_asset",
    description: "生成图片资产（支持单个或批量）。可以是从零生成，也可以基于现有素材进行图生图。适合创建角色、场景、道具等视觉素材。",
    displayName: "生成图片资产",
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
    name: "generate_video_asset",
    description: `生成视频资产。基于起始帧（必填）和结束帧（可选）生成视频过渡动画。系统会自动使用配置的视频服务提供商（Kling 或 Veo）。

## 使用说明

**适用场景：** 场景切换、时间流逝、物体变化等需要画面过渡的场景

**参数要求：**
- **prompt**（必填）：详细描述视频内容和镜头运动（≥10字符）
- **start_image_url**（必填）：起始帧图片的资产ID或URL
- **end_image_url**（可选）：结束帧图片的资产ID或URL，不提供则由AI自动生成过渡
- **duration**（可选）：视频时长，"5" 或 "10" 秒，默认 "5"
- **aspect_ratio**（可选）：宽高比，"16:9"、"9:16" 或 "1:1"，默认 "16:9"

**示例：**
\`\`\`json
{
  "prompt": "Smooth camera push-in. Cinematic transition from winter to spring.",
  "start_image_url": "asset-winter-scene",
  "end_image_url": "asset-spring-scene",
  "duration": "5",
  "title": "冬春季节过渡"
}
\`\`\`

**注意事项：**
1. prompt 应该详细描述镜头运动和画面内容
2. 图片资产ID需要从 query_assets 查询获得
3. 视频生成需要一定时间，任务创建后可通过轮询查看状态
`,
    displayName: "生成视频资产",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "视频描述（必填），详细描述视频内容和镜头运动，至少10个字符",
        },
        start_image_url: {
          type: "string",
          description: "起始帧（必填），图片资产的ID或URL",
        },
        end_image_url: {
          type: "string",
          description: "结束帧（可选），图片资产的ID或URL。不提供则由AI生成过渡",
        },
        duration: {
          type: "string",
          description: "视频时长（可选），字符串 '5' 或 '10'，默认 '5'",
        },
        aspect_ratio: {
          type: "string",
          description: "宽高比（可选），'16:9'、'9:16' 或 '1:1'，默认 '16:9'",
        },
        negative_prompt: {
          type: "string",
          description: "负面提示词（可选），用于避免不想要的内容",
        },
        title: {
          type: "string",
          description: "视频标题（可选），便于识别和管理",
        },
        referenceAssetIds: {
          type: "array",
          description: "参考素材ID数组（可选）。这些素材将用于视频生成",
        },
        tags: {
          type: "array",
          description: "标签数组（可选），用于分类和筛选，如 ['开场', '动作', '对话']",
        },
        order: {
          type: "number",
          description: "排序值（可选），用于在视频库中排序",
        },
      },
      required: ["prompt", "start_image_url"],
    },
    category: "generation",
    needsConfirmation: true,
  },

  // ============================================
  // 修改类工具（需要确认）
  // ============================================
  {
    name: "update_asset",
    description: "修改资产信息（支持单个或批量，同时支持图片素材和视频素材）。只允许修改 name（名称）和 tags（标签），不允许修改 prompt 等生成配置字段。适合批量重命名、添加标签分类、优化素材管理。",
    displayName: "修改资产",
    parameters: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          description: "更新数组，每项包含 assetId（必填，可以是图片或视频的ID）和要修改的字段（name, tags）",
        },
      },
      required: ["updates"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "set_art_style",
    description: "为项目设置美术风格。风格会影响所有后续图像生成的整体外观和氛围。先用 query_context 获取可用风格列表，然后使用风格对象的 id 字段作为 styleId 参数。",
    displayName: "设置美术风格",
    parameters: {
      type: "object",
      properties: {
        styleId: {
          type: "string",
          description: "美术风格的唯一标识符。必须使用 query_context 返回的 artStyles 数组中某个风格对象的 id 字段（例如：artStyles[0].id），不要使用 name 字段",
        },
      },
      required: ["styleId"],
    },
    category: "modification",
    needsConfirmation: true,
  },

  // ============================================
  // 删除类工具（需要确认）
  // ============================================
  {
    name: "delete_asset",
    description: "删除资产（支持单个或批量，同时支持图片素材和视频素材）。删除后无法恢复，请谨慎使用。适合清理不需要的素材、删除生成失败的资产。",
    displayName: "删除资产",
    parameters: {
      type: "object",
      properties: {
        assetIds: {
          type: "array",
          description: "要删除的资产ID数组（可以是图片或视频的ID）",
        },
      },
      required: ["assetIds"],
    },
    category: "deletion",
    needsConfirmation: true,
  },

  // ============================================
  // 文本资产工具
  // ============================================
  {
    name: "create_text_asset",
    description: "创建文本资产，用于记录角色小传、剧本、分镜设计、世界观设定等文本信息。这些文本可以被后续查询和引用，作为项目的知识库。",
    displayName: "创建文本资产",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "资产名称，如'张三角色小传'、'第一幕剧本'",
        },
        content: {
          type: "string",
          description: "文本内容，支持 Markdown 格式",
        },
        format: {
          type: "string",
          description: "文本格式：'markdown'（默认）或 'plain'",
          enum: ["markdown", "plain"],
        },
        tags: {
          type: "array",
          description: "标签数组，如 ['角色小传', '主角'] 或 ['剧本', '第一幕']",
          items: {
            type: "string",
          },
        },
      },
      required: ["name", "content"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "query_text_assets",
    description: "查询并读取文本资产内容。可以按标签筛选，返回完整的文本内容用于参考。适合在需要查看角色设定、剧本内容、分镜设计等信息时使用。",
    displayName: "查询文本资产",
    parameters: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          description: "标签筛选数组，如 ['角色小传'] 或 ['剧本']",
          items: {
            type: "string",
          },
        },
        limit: {
          type: "number",
          description: "返回数量限制，默认10",
        },
      },
    },
    category: "read",
    needsConfirmation: false,
  },
];

/**
 * 根据名称获取 Function 定义
 */
export function getFunctionDefinition(name: string): FunctionDefinition | undefined {
  return AGENT_FUNCTIONS.find((f) => f.name === name);
}
