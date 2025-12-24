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
        tags: {
          type: "string",
          description: "标签筛选（逗号分隔），如 'character,male' 或 'prop,weapon'",
        },
        limit: {
          type: "string",
          description: "返回数量限制，默认20",
        },
      },
      required: [],
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
      properties: {},
      required: [],
    },
    category: "read",
    needsConfirmation: false,
  },
  {
    name: "query_available_art_styles",
    description: "查询可用的美术风格列表（系统预设风格）。用于为项目推荐或设置合适的美术风格",
    displayName: "查询美术风格",
    parameters: {
      type: "object",
      properties: {},
    },
    category: "read",
    needsConfirmation: false,
  },

  // ============================================
  // 创建类工具（需要确认）
  // ============================================
  {
    name: "create_shot",
    description: "创建一个新的分镜。需要指定景别和描述，其他参数可选",
    displayName: "创建分镜",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID",
        },
        order: {
          type: "string",
          description: "分镜序号（整数），如不指定则自动追加到末尾",
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
          description: "运镜方式，默认 'static'",
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
        duration: {
          type: "string",
          description: "时长（毫秒），默认3000",
        },
        description: {
          type: "string",
          description: "描述（中文），包含画面内容、对话、动作、表情情绪等",
        },
        visualPrompt: {
          type: "string",
          description: "图像生成提示词（英文自然语言描述）",
        },
      },
      required: ["episodeId", "shotSize", "description"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "batch_create_shots",
    description: "批量创建多个分镜。支持指定order插入到特定位置，如果order冲突会自动调整现有分镜位置。适用于一次性创建多个分镜的场景。",
    displayName: "批量创建分镜",
    parameters: {
      type: "object",
      properties: {
        episodeId: {
          type: "string",
          description: "剧集ID",
        },
        shots: {
          type: "string",
          description: '分镜数组（JSON字符串格式），每个分镜包含 shotSize（必填）、description（必填）、order（可选，整数）、cameraMovement（可选）、duration（可选，毫秒）、visualPrompt（可选）。示例：[{"shotSize":"medium_shot","description":"主角走进房间","order":2},{"shotSize":"close_up","description":"主角的表情特写"}]',
        },
      },
      required: ["episodeId", "shots"],
    },
    category: "generation",
    needsConfirmation: true,
  },

  // ============================================
  // 生成类工具（需要确认）
  // ============================================
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
          description: '标签（逗号分隔），包含类型和名称，如 "角色,男性,张三" 或 "场景,室内,卧室"',
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
      required: ["prompt"],
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
        assets: {
          type: "string",
          description: '素材数组（JSON字符串格式），每个素材包含 name（名称）、prompt（英文自然语言描述，用完整句子描述画面）、tags（逗号分隔的标签字符串，如"角色,男性"）、sourceAssetIds（可选，参考素材ID数组）。示例：[{"name":"林晓","prompt":"A young man...","tags":"角色,男性,主角"}]',
        },
      },
      required: ["assets"],
    },
    category: "generation",
    needsConfirmation: true,
  },

  // ============================================
  // 修改类工具（需要确认）
  // ============================================
  {
    name: "update_shot",
    description: "修改分镜的属性（如时长、景别、运镜、描述等），也可以用来关联素材图片到分镜",
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
        description: {
          type: "string",
          description: "描述（中文），包含画面内容、对话、动作、表情情绪等",
        },
        visualPrompt: {
          type: "string",
          description: "图像生成提示词（英文自然语言描述，用完整句子描述画面内容）",
        },
        imageAssetId: {
          type: "string",
          description: "关联的素材ID，用于将素材图片关联到分镜。先用 generate_asset 生成素材获取 assetId，再用此参数关联到分镜",
        },
      },
      required: ["shotId"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "update_asset",
    description: "修改素材信息（名称和标签）",
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
        tags: {
          type: "string",
          description: "标签（逗号分隔），如 \"角色,男性,张三\"",
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
  {
    name: "set_project_art_style",
    description: "为项目设置美术风格。美术风格会影响所有图像生成的整体风格和氛围",
    displayName: "设置美术风格",
    parameters: {
      type: "object",
      properties: {
        styleId: {
          type: "string",
          description: "风格ID（从 query_available_art_styles 获取）",
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
];

/**
 * 根据名称获取 Function 定义
 */
export function getFunctionDefinition(name: string): FunctionDefinition | undefined {
  return AGENT_FUNCTIONS.find((f) => f.name === name);
}

