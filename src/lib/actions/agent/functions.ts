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

  /**
   * 查询项目完整上下文
   * 包括项目信息（标题、描述、当前画风）、视频列表、素材统计、可用美术风格等
   * 适合在对话开始时了解项目全貌
   */
  {
    name: "query_context",
    description:
      "Query project context: info, assets summary, videos, art styles. Use at conversation start to understand project state.",
    displayName: "queryContext",
    parameters: {
      type: "object",
      properties: {
        includeProjectInfo: {
          type: "boolean",
          description: "Include project info (title, description, style). Default true",
        },
        includeAssets: {
          type: "boolean",
          description: "Include assets summary. Default true",
        },
        includeVideos: {
          type: "boolean",
          description: "Include video list. Default true",
        },
        includeArtStyles: {
          type: "boolean",
          description: "Include available art styles. Default true",
        },
      },
    },
    category: "read",
    needsConfirmation: false,
  },

  /**
   * 查询项目资产库（图片/视频素材）
   * 支持按类型和标签筛选
   * 返回 ID、名称、状态、selectionStatus（selected=精选/rejected=废弃/unrated=未评价）、prompt、标签
   * 生成新内容时优先引用 selected 素材，避免 rejected 素材
   */
  {
    name: "query_assets",
    description:
      "Query project assets (images/videos). Filter by type and tags. Returns ID, name, status, selectionStatus (selected/rejected/unrated), prompt, tags. Prefer 'selected' assets for new content.",
    displayName: "queryAssets",
    parameters: {
      type: "object",
      properties: {
        assetType: {
          type: "string",
          description: "Filter by type: 'image' or 'video'. Omit for all",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags array",
        },
        limit: {
          type: "number",
          description: "Max results. Default 20",
        },
      },
    },
    category: "read",
    needsConfirmation: false,
  },

  // ============================================
  // 创作类工具（生成/创建，需要确认）
  // ============================================

  /**
   * 生成或编辑图片资产
   *
   * 三种模式：
   * 1. 文生图：只提供 prompt，从零生成
   * 2. 图片编辑：sourceAssetIds + prompt 描述修改操作
   * 3. 多图合成：多个 sourceAssetIds + prompt 描述如何合成
   *
   * 角色一致性：生成分镜图时，用 sourceAssetIds 引用角色三视图，模型会提取角色特征保持一致
   *
   * 参考素材背景要求：
   * - 角色三视图/四视图、道具、场景等参考素材必须使用白色或浅灰色背景
   * - 场景素材应只表达场景本身，不应包含人物
   */
  {
    name: "generate_image_asset",
    description:
      "Generate or edit images. Modes: (1) text-to-image with prompt only, (2) edit with sourceAssetIds + prompt, (3) composite multiple images. Use sourceAssetIds to reference character turnarounds for consistency.",
    displayName: "generateImageAsset",
    parameters: {
      type: "object",
      properties: {
        assets: {
          type: "array",
          description: "Array of assets to generate",
          items: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "Image description (required). Auto-translated",
              },
              name: {
                type: "string",
                description: "Asset name (optional)",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags array (optional)",
              },
              sourceAssetIds: {
                type: "array",
                items: { type: "string" },
                description: "Reference asset IDs for editing or compositing",
              },
              aspect_ratio: {
                type: "string",
                description: "Aspect ratio: 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16. Default 16:9",
              },
            },
          },
        },
      },
      required: ["assets"],
    },
    category: "generation",
    needsConfirmation: true,
  },

  // generate_video_asset 通过 getVideoFunctionDefinition() 动态生成

  // ============================================
  // 修改类工具（需要确认）
  // ============================================

  /**
   * 修改资产信息（支持单个或批量，图片和视频素材）
   * 只允许修改 name（名称）和 tags（标签）
   * 不允许修改 prompt 等生成配置字段
   * 适合批量重命名、添加标签分类、优化素材管理
   */
  {
    name: "update_asset",
    description:
      "Update asset metadata (name, tags only). Supports batch updates for images and videos. Cannot modify prompt or generation config.",
    displayName: "updateAsset",
    parameters: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              assetId: { type: "string", description: "Asset ID (required)" },
              name: { type: "string", description: "New name (optional)" },
              tags: { type: "array", items: { type: "string" }, description: "New tags (optional)" },
            },
          },
          description: "Array of updates with assetId and fields to modify",
        },
      },
      required: ["updates"],
    },
    category: "modification",
    needsConfirmation: true,
  },

  /**
   * 设置项目信息
   * 包括标题、描述、美术风格
   * 至少需要提供一个字段
   * 设置美术风格时，可直接传入英文风格描述，或用 query_context 获取预设风格的 prompt
   */
  {
    name: "set_project_info",
    description:
      "Set project info: title, description, or art style. Provide at least one field. For stylePrompt, use English style description or get from query_context artStyles.",
    displayName: "setProjectInfo",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Project title",
        },
        description: {
          type: "string",
          description: "Project description",
        },
        stylePrompt: {
          type: "string",
          description: "Art style prompt in English",
        },
      },
    },
    category: "modification",
    needsConfirmation: true,
  },

  // ============================================
  // 删除类工具（需要确认）
  // ============================================

  /**
   * 删除资产（支持单个或批量）
   * 支持图片、视频、音频和文本素材
   * 删除后无法恢复，请谨慎使用
   * 适合清理不需要的素材、删除生成失败的资产
   */
  {
    name: "delete_asset",
    description:
      "Delete assets (batch supported). Works with images, videos, audio, text. Irreversible.",
    displayName: "deleteAsset",
    parameters: {
      type: "object",
      properties: {
        assetIds: {
          type: "array",
          items: { type: "string" },
          description: "Asset IDs to delete",
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

  /**
   * 创建文本资产
   * 用于记录角色小传、剧本、分镜设计、世界观设定等文本信息
   * 这些文本可以被后续查询和引用，作为项目的知识库
   */
  {
    name: "create_text_asset",
    description:
      "Create text asset for character bios, scripts, storyboards, worldbuilding. Supports markdown. Can be queried later as project knowledge base.",
    displayName: "createTextAsset",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Asset name",
        },
        content: {
          type: "string",
          description: "Text content (markdown supported)",
        },
        format: {
          type: "string",
          description: "Format: 'markdown' (default) or 'plain'",
          enum: ["markdown", "plain"],
        },
        tags: {
          type: "array",
          description: "Tags array",
          items: { type: "string" },
        },
      },
      required: ["name", "content"],
    },
    category: "generation",
    needsConfirmation: true,
  },

  /**
   * 查询并读取文本资产内容
   * 可以按标签筛选，返回完整的文本内容用于参考
   * 适合查看角色设定、剧本内容、分镜设计等信息
   */
  {
    name: "query_text_assets",
    description:
      "Query and read text assets. Filter by tags. Returns full content for reference (character bios, scripts, etc).",
    displayName: "queryTextAssets",
    parameters: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          description: "Filter by tags",
          items: { type: "string" },
        },
        limit: {
          type: "number",
          description: "Max results. Default 10",
        },
      },
    },
    category: "read",
    needsConfirmation: false,
  },

  // ============================================
  // 剪辑工具
  // ============================================

  /**
   * 查询项目的所有剪辑列表
   * 返回每个剪辑的基本信息（ID、标题、时长、片段数量等）
   * 一个项目可以有多个剪辑，用于制作不同版本的视频
   */
  {
    name: "query_cuts",
    description: "List all cuts in project. Returns ID, title, duration, clip count for each cut.",
    displayName: "queryCuts",
    parameters: {
      type: "object",
      properties: {},
    },
    category: "read",
    needsConfirmation: false,
  },

  /**
   * 查询单个剪辑的详细状态
   * 返回：总时长、片段列表、每个片段的素材详情（ID、名称、prompt、标签、时长、位置等）
   * 执行剪辑操作前应先调用此函数了解现状
   */
  {
    name: "query_cut",
    description:
      "Get cut details: duration, clips list with asset info (ID, name, prompt, tags, duration, position). Call before editing.",
    displayName: "queryCut",
    parameters: {
      type: "object",
      properties: {
        cutId: {
          type: "string",
          description: "Cut ID. Omit for first cut",
        },
      },
    },
    category: "read",
    needsConfirmation: false,
  },

  /**
   * 创建新的剪辑
   * 每个项目可以有多个剪辑，用于制作不同版本或不同内容的视频
   * 创建后可以使用 add_clip 添加素材到剪辑中
   */
  {
    name: "create_cut",
    description: "Create new cut for different video versions. Use add_clip to add assets after creation.",
    displayName: "createCut",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Cut title",
        },
        description: {
          type: "string",
          description: "Cut description",
        },
        resolution: {
          type: "string",
          description: "Resolution like '1920x1080'. Default '1080x1920'",
        },
        fps: {
          type: "number",
          description: "Frame rate. Default 30",
        },
      },
    },
    category: "generation",
    needsConfirmation: true,
  },

  /**
   * 删除剪辑
   * 删除后无法恢复，剪辑中的所有片段也会被删除（但素材本身不会被删除）
   */
  {
    name: "delete_cut",
    description: "Delete cut. Irreversible. Clips removed but source assets preserved.",
    displayName: "deleteCut",
    parameters: {
      type: "object",
      properties: {
        cutId: {
          type: "string",
          description: "Cut ID to delete",
        },
      },
      required: ["cutId"],
    },
    category: "deletion",
    needsConfirmation: true,
  },

  /**
   * 添加素材到剪辑
   * 支持视频轨道(0-99)和音频轨道(100+)
   * 不指定 trackIndex 时根据素材类型自动选择（视频/图片→轨道0，音频→轨道100）
   * 音频轨道可通过 startTime 自由定位实现精确同步
   */
  {
    name: "add_clip",
    description:
      "Add asset to cut. Video tracks: 0-99, audio tracks: 100+. Auto-selects track by asset type if not specified. Use startTime for audio sync.",
    displayName: "addClip",
    parameters: {
      type: "object",
      properties: {
        cutId: {
          type: "string",
          description: "Cut ID. Omit for first cut",
        },
        assetId: {
          type: "string",
          description: "Asset ID (required)",
        },
        trackIndex: {
          type: "number",
          description: "Track index. Video: 0-99, Audio: 100+. Auto if omitted",
        },
        duration: {
          type: "number",
          description: "Duration in ms. Required for images",
        },
        startTime: {
          type: "number",
          description: "Start position in ms. For audio sync",
        },
        insertAt: {
          type: "string",
          description: "Insert position: 'end' (default), 'start', or clipId",
        },
        trimStart: {
          type: "number",
          description: "Trim start in ms. Default 0",
        },
        trimEnd: {
          type: "number",
          description: "Trim end in ms. Default to end",
        },
      },
      required: ["assetId"],
    },
    category: "modification",
    needsConfirmation: true,
  },

  /**
   * 从剪辑中移除片段
   * 视频轨道删除后自动波纹编辑（后续片段自动前移）
   * 音频轨道删除后保持自由定位，不影响其他片段位置
   */
  {
    name: "remove_clip",
    description:
      "Remove clip from cut. Video track: ripple edit (subsequent clips shift). Audio track: free positioning preserved.",
    displayName: "removeClip",
    parameters: {
      type: "object",
      properties: {
        clipId: {
          type: "string",
          description: "Clip ID to remove",
        },
      },
      required: ["clipId"],
    },
    category: "modification",
    needsConfirmation: true,
  },

  /**
   * 更新片段属性
   * 可修改：时长、裁剪点、顺序位置、替换素材
   * 一次调用可修改多个属性
   */
  {
    name: "update_clip",
    description: "Update clip: duration, trim points, position, or replace asset. Multiple fields in one call.",
    displayName: "updateClip",
    parameters: {
      type: "object",
      properties: {
        cutId: {
          type: "string",
          description: "Cut ID. Omit for first cut",
        },
        clipId: {
          type: "string",
          description: "Clip ID (required)",
        },
        duration: {
          type: "number",
          description: "New duration in ms",
        },
        trimStart: {
          type: "number",
          description: "New trim start in ms",
        },
        trimEnd: {
          type: "number",
          description: "New trim end in ms",
        },
        moveToPosition: {
          type: "number",
          description: "Move to position (0=first)",
        },
        replaceWithAssetId: {
          type: "string",
          description: "Replace with new asset ID",
        },
      },
      required: ["clipId"],
    },
    category: "modification",
    needsConfirmation: true,
  },

  /**
   * 添加新的音频轨道
   * 当需要多条音频同时播放时使用（如背景音乐+音效+对白）
   * 默认已有一条音频轨道（索引100），此函数用于添加额外的音频轨道
   */
  {
    name: "add_audio_track",
    description:
      "Add audio track for layered audio (BGM + SFX + dialogue). Default track is 100, this adds more.",
    displayName: "addAudioTrack",
    parameters: {
      type: "object",
      properties: {
        cutId: {
          type: "string",
          description: "Cut ID. Omit for first cut",
        },
        name: {
          type: "string",
          description: "Track name like 'BGM', 'SFX', 'Dialogue'",
        },
      },
    },
    category: "modification",
    needsConfirmation: true,
  },

  // ============================================
  // 音频生成工具（需要确认）
  // ============================================

  /**
   * 生成音效资产（ElevenLabs Sound Effect V2）
   *
   * 适用场景：脚步声、爆炸声、环境音、UI 音效等
   *
   * 参数：
   * - prompt（必填）：中英文音效描述均可，系统会自动翻译
   * - name（可选）：资产名称
   * - duration（可选）：时长 0.5-22 秒
   * - is_loopable（可选）：是否生成可循环音效
   * - tags（可选）：标签数组
   *
   * 积分消耗：1 积分/次
   */
  {
    name: "generate_sound_effect",
    description:
      "Generate sound effect (ElevenLabs). For footsteps, explosions, ambient, UI sounds. Duration 0.5-22s. 1 credit/generation.",
    displayName: "generateSoundEffect",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Sound description (required). Auto-translated",
        },
        name: {
          type: "string",
          description: "Asset name (optional)",
        },
        duration: {
          type: "number",
          description: "Duration 0.5-22 seconds (optional)",
        },
        is_loopable: {
          type: "boolean",
          description: "Generate loopable sound (optional)",
        },
        tags: {
          type: "array",
          description: "Tags array (optional)",
          items: { type: "string" },
        },
      },
      required: ["prompt"],
    },
    category: "generation",
    needsConfirmation: true,
  },

  /**
   * 生成背景音乐资产（Suno AI）
   *
   * 适用场景：场景配乐、情绪渲染、片头片尾音乐等
   *
   * 参数：
   * - prompt（必填）：音乐描述或歌词，描述风格、情绪、节奏
   * - name（可选）：资产名称
   * - genre（可选）：音乐风格，如 orchestral, electronic, jazz
   * - mood（可选）：情绪氛围，如 tense, peaceful, exciting
   * - instrumental（可选）：是否纯音乐（无人声），默认 true
   * - tags（可选）：标签数组
   *
   * 积分消耗：10 积分/次
   */
  {
    name: "generate_bgm",
    description:
      "Generate background music (Suno AI). For scene scoring, mood, intro/outro. Specify genre and mood. 10 credits/generation.",
    displayName: "generateBgm",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Music description (required). Auto-translated",
        },
        name: {
          type: "string",
          description: "Asset name (optional)",
        },
        genre: {
          type: "string",
          description: "Genre: orchestral, electronic, jazz, rock, etc",
        },
        mood: {
          type: "string",
          description: "Mood: tense, peaceful, exciting, melancholic, etc",
        },
        instrumental: {
          type: "boolean",
          description: "Instrumental only (no vocals). Default true",
        },
        tags: {
          type: "array",
          description: "Tags array (optional)",
          items: { type: "string" },
        },
      },
      required: ["prompt"],
    },
    category: "generation",
    needsConfirmation: true,
  },

  /**
   * 生成台词配音资产（MiniMax Speech TTS）
   *
   * 适用场景：角色对白、旁白、画外音等
   *
   * 参数：
   * - text（必填）：要朗读的文本内容（支持中英文）
   * - voice_id（必填）：音色ID，使用系统预设音色
   * - name（可选）：资产名称，建议包含角色名
   * - emotion（可选）：情感表达 happy/sad/angry/fearful/neutral 等
   * - speed（可选）：语速 0.5-2.0，默认 1.0
   * - pitch（可选）：音调 -12 到 12，默认 0
   * - tags（可选）：标签数组
   *
   * 可用音色：
   * - 男声：male-qn-qingse, male-qn-jingying, male-qn-badao, male-qn-daxuesheng, presenter_male, audiobook_male_1
   * - 女声：female-shaonv, female-yujie, female-chengshu, female-tianmei, presenter_female, audiobook_female_1
   *
   * 注意：同一角色的台词应使用相同的 voice_id 以保持一致性
   *
   * 积分消耗：约 0.6 积分/100字
   */
  {
    name: "generate_dialogue",
    description:
      "Generate voice dialogue (MiniMax TTS). For character lines, narration. Use same voice_id for character consistency. ~0.6 credits/100 chars.",
    displayName: "generateDialogue",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to speak (required). Max 500 chars recommended",
        },
        voice_id: {
          type: "string",
          description: "Voice ID (required). Male: male-qn-qingse/jingying/badao/daxuesheng, presenter_male, audiobook_male_1. Female: female-shaonv/yujie/chengshu/tianmei, presenter_female, audiobook_female_1",
        },
        name: {
          type: "string",
          description: "Asset name. Include character name",
        },
        emotion: {
          type: "string",
          description: "Emotion: happy, sad, angry, fearful, disgusted, surprised, neutral",
          enum: ["happy", "sad", "angry", "fearful", "disgusted", "surprised", "neutral"],
        },
        speed: {
          type: "number",
          description: "Speed 0.5-2.0. Default 1.0",
        },
        pitch: {
          type: "number",
          description: "Pitch -12 to 12. Default 0",
        },
        tags: {
          type: "array",
          description: "Tags array. Include character name",
          items: { type: "string" },
        },
      },
      required: ["text", "voice_id"],
    },
    category: "generation",
    needsConfirmation: true,
  },
];

/**
 * 视频生成 Function 定义（Veo 3.1）
 * - 支持 1-3 张参考图片
 * - 固定 8 秒时长
 * - 支持 16:9 和 9:16 比例
 */
export const VIDEO_FUNCTION: FunctionDefinition = {
  name: "generate_video_asset",
  description:
    "[Veo 3.1] Generate video using reference images. IMPORTANT: Use reference_image_ids (NOT subjects). Limits: max 3 reference images. Duration: fixed 8s. Aspect ratios: 16:9, 9:16.",
  displayName: "generateVideoAsset",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Video description, min 10 chars",
      },
      reference_image_ids: {
        type: "array",
        items: { type: "string" },
        description: "Reference image asset IDs (1-3)",
      },
      aspect_ratio: {
        type: "string",
        description: "Aspect ratio: '16:9' or '9:16'. Default '16:9'",
      },
      title: {
        type: "string",
        description: "Video title (optional)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Tags array (optional)",
      },
      order: {
        type: "number",
        description: "Sort order (optional)",
      },
    },
    required: ["prompt", "reference_image_ids"],
  },
  category: "generation",
  needsConfirmation: true,
};

/**
 * 根据名称获取 Function 定义
 */
export function getFunctionDefinition(
  name: string
): FunctionDefinition | undefined {
  if (name === "generate_video_asset") {
    return VIDEO_FUNCTION;
  }
  return AGENT_FUNCTIONS.find((f) => f.name === name);
}

/**
 * 获取所有 Agent Functions
 */
export function getAgentFunctions(): FunctionDefinition[] {
  return [...AGENT_FUNCTIONS, VIDEO_FUNCTION];
}
