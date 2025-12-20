/**
 * Agent Function 工具定义
 * 
 * 定义所有 AI Agent 可以调用的工具
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
    name: "query_script_content",
    description: "读取指定剧集的剧本内容，用于分析剧本、提取信息等",
    displayName: "读取剧本内容",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID",
        },
      },
      required: ["episodeId"],
    },
    category: "read",
    needsConfirmation: false,
  },
  {
    name: "query_assets",
    description: "查询项目中的素材库，支持按标签筛选。可以查找角色、场景、道具等",
    displayName: "查询素材库",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "项目ID",
        },
        tags: {
          type: "string",
          description: "标签筛选（逗号分隔），如 'character,male' 或 'prop,weapon'",
        },
        limit: {
          type: "string",
          description: "返回数量限制，默认20",
        },
      },
      required: ["projectId"],
    },
    category: "read",
    needsConfirmation: false,
  },
  {
    name: "query_shots",
    description: "查询指定剧集的所有分镜信息",
    displayName: "查询分镜列表",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID",
        },
      },
      required: ["episodeId"],
    },
    category: "read",
    needsConfirmation: false,
  },
  {
    name: "query_shot_details",
    description: "查询指定分镜的详细信息",
    displayName: "查询分镜详情",
    parameters: {
      type: "object",
      properties: {
        shotId: {
          type: "string",
          description: "分镜ID",
        },
      },
      required: ["shotId"],
    },
    category: "read",
    needsConfirmation: false,
  },
  {
    name: "analyze_project_stats",
    description: "分析项目统计信息，包括素材数量、分镜进度等",
    displayName: "分析项目统计",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "项目ID",
        },
      },
      required: ["projectId"],
    },
    category: "read",
    needsConfirmation: false,
  },

  // ============================================
  // 生成类工具（需要确认）
  // ============================================
  {
    name: "generate_storyboard",
    description: "根据剧本自动生成分镜脚本（包括景别、运镜、对话等）",
    displayName: "生成分镜脚本",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID",
        },
        autoGenerateImages: {
          type: "string",
          description: "是否自动为分镜生成图片，值为 'true' 或 'false'，默认 'false'",
        },
      },
      required: ["episodeId"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "decompose_shot",
    description: "将一个分镜拆解成多个更细致的子分镜，用于加快节奏或增加细节",
    displayName: "拆解分镜",
    parameters: {
      type: "object",
      properties: {
        shotId: {
          type: "string",
          description: "要拆解的分镜ID",
        },
        reason: {
          type: "string",
          description: "拆解理由，帮助AI更好地拆解",
        },
      },
      required: ["shotId"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "batch_decompose_shots",
    description: "批量拆解多个分镜",
    displayName: "批量拆解分镜",
    parameters: {
      type: "object",
      properties: {
        shotIds: {
          type: "string",
          description: "分镜ID数组（JSON字符串格式）",
        },
        reason: {
          type: "string",
          description: "拆解理由",
        },
      },
      required: ["shotIds"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "generate_shot_images",
    description: "为指定的分镜生成图片",
    displayName: "生成分镜图片",
    parameters: {
      type: "object",
      properties: {
        shotIds: {
          type: "string",
          description: "分镜ID数组（JSON字符串格式）",
        },
      },
      required: ["shotIds"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "generate_shot_videos",
    description: "为指定的分镜生成视频（需要分镜已有图片）",
    displayName: "生成分镜视频",
    parameters: {
      type: "object",
      properties: {
        shotIds: {
          type: "string",
          description: "分镜ID数组（JSON字符串格式）",
        },
      },
      required: ["shotIds"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "generate_asset",
    description: "生成素材图片并创建素材记录。可选提供名称和标签（推荐），否则由AI自动分析。支持引用其他素材作为参考图（图生图）。",
    displayName: "生成素材",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "项目ID",
        },
        prompt: {
          type: "string",
          description: "图像生成提示词（英文自然语言描述，不要使用逗号分隔的短词，而是用完整的句子描述画面内容、人物、场景、光线、氛围等）",
        },
        name: {
          type: "string",
          description: "素材名称（可选，建议提供）",
        },
        tags: {
          type: "string",
          description: '标签数组（JSON字符串格式），包含类型标签如"角色"、"场景"、"道具"、"分镜"等，例如 \'["角色", "男性", "张三"]\'',
        },
        numImages: {
          type: "string",
          description: "生成数量，默认1",
        },
        sourceAssetIds: {
          type: "string",
          description: "参考素材ID数组（JSON字符串格式），用于图生图模式。先用 query_assets 查询获取素材ID",
        },
      },
      required: ["projectId", "prompt"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "batch_generate_assets",
    description: "批量生成多个素材图片并创建记录。适用于一次性创建多个角色、场景等素材。每个素材会创建独立的生成任务并行处理。",
    displayName: "批量生成素材",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "项目ID",
        },
        assets: {
          type: "string",
          description: '素材数组（JSON字符串格式），每个素材包含 name（名称）、prompt（英文自然语言描述，用完整句子描述画面）、tags（标签数组，如["角色","男性"]）、sourceAssetIds（可选，参考素材ID数组）',
        },
      },
      required: ["projectId", "assets"],
    },
    category: "generation",
    needsConfirmation: true,
  },

  // ============================================
  // 修改类工具（需要确认）
  // ============================================
  {
    name: "update_shot",
    description: "修改分镜的属性（如时长、景别、运镜等）",
    displayName: "修改分镜",
    parameters: {
      type: "object",
      properties: {
        shotId: {
          type: "string",
          description: "分镜ID",
        },
        duration: {
          type: "string",
          description: "时长（毫秒）",
        },
        shotSize: {
          type: "string",
          description: "景别",
          enum: [
            "extreme_long_shot",
            "long_shot",
            "full_shot",
            "medium_shot",
            "close_up",
            "extreme_close_up",
          ],
        },
        cameraMovement: {
          type: "string",
          description: "运镜方式",
          enum: [
            "static",
            "push_in",
            "pull_out",
            "pan_left",
            "pan_right",
            "tilt_up",
            "tilt_down",
            "tracking",
            "crane_up",
            "crane_down",
            "orbit",
            "zoom_in",
            "zoom_out",
            "handheld",
          ],
        },
        visualDescription: {
          type: "string",
          description: "视觉描述（中文）",
        },
        visualPrompt: {
          type: "string",
          description: "图像生成提示词（英文自然语言描述，用完整句子描述画面内容）",
        },
      },
      required: ["shotId"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "batch_update_shot_duration",
    description: "批量修改分镜时长",
    displayName: "批量修改分镜时长",
    parameters: {
      type: "object",
      properties: {
        shotIds: {
          type: "string",
          description: "分镜ID数组（JSON字符串格式）",
        },
        duration: {
          type: "string",
          description: "新的时长（毫秒）",
        },
      },
      required: ["shotIds", "duration"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "update_asset",
    description: "修改素材信息",
    displayName: "修改素材",
    parameters: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "素材ID",
        },
        name: {
          type: "string",
          description: "素材名称",
        },
        prompt: {
          type: "string",
          description: "生成提示词",
        },
        tags: {
          type: "string",
          description: "标签数组（JSON字符串格式）",
        },
      },
      required: ["assetId"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "reorder_shots",
    description: "重新排序分镜",
    displayName: "重新排序分镜",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID",
        },
        shotOrders: {
          type: "string",
          description: "新的顺序映射（JSON对象字符串，key为shotId，value为新order）",
        },
      },
      required: ["episodeId", "shotOrders"],
    },
    category: "modification",
    needsConfirmation: true,
  },

  // ============================================
  // 删除类工具（需要确认）
  // ============================================
  {
    name: "delete_shots",
    description: "删除指定的分镜",
    displayName: "删除分镜",
    parameters: {
      type: "object",
      properties: {
        shotIds: {
          type: "string",
          description: "要删除的分镜ID数组（JSON字符串格式）",
        },
      },
      required: ["shotIds"],
    },
    category: "deletion",
    needsConfirmation: true,
  },
  {
    name: "delete_asset",
    description: "删除素材",
    displayName: "删除素材",
    parameters: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "素材ID",
        },
      },
      required: ["assetId"],
    },
    category: "deletion",
    needsConfirmation: true,
  },
  {
    name: "delete_assets",
    description: "批量删除素材",
    displayName: "批量删除素材",
    parameters: {
      type: "object",
      properties: {
        assetIds: {
          type: "string",
          description: "素材ID数组（JSON字符串格式）",
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

/**
 * 获取指定分类的 Functions
 */
export function getFunctionsByCategory(category: string): FunctionDefinition[] {
  return AGENT_FUNCTIONS.filter((f) => f.category === category);
}

/**
 * 将 Function 定义转换为 OpenAI function calling 格式
 */
export function toOpenAIFunctionFormat(funcs: FunctionDefinition[]) {
  return funcs.map((func) => ({
    name: func.name,
    description: func.description,
    parameters: func.parameters,
  }));
}

