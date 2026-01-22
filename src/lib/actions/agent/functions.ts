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
    description: "查询项目完整上下文，包括项目信息（标题、描述、当前画风）、视频列表、素材统计、可用美术风格等。这是一个综合查询工具，适合在对话开始时了解项目全貌。",
    displayName: "查询项目上下文",
    parameters: {
      type: "object",
      properties: {
        includeProjectInfo: {
          type: "boolean",
          description: "是否包含项目基础信息（标题、描述、当前画风），默认true",
        },
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
    description: `生成或编辑图片资产。

**四种模式**：
1. **文生图**：只提供 prompt，从零生成
2. **图片编辑**：sourceAssetIds + prompt 描述修改操作
3. **多图合成**：多个 sourceAssetIds + prompt 描述如何合成
4. **重新生成**：targetAssetId + prompt，为已有素材生成新版本

**角色一致性**：生成分镜图时，用 sourceAssetIds 引用角色三视图，模型会提取角色特征保持一致

**参考素材背景要求**：
- 角色三视图/四视图、道具、场景等参考素材必须使用白色或浅灰色背景
- 场景素材应只表达场景本身，不应包含人物
`,
    displayName: "生成图片资产",
    parameters: {
      type: "object",
      properties: {
        assets: {
          type: "array",
          description: "素材数组，每个素材包含: prompt（必填，英文描述）、name（可选）、tags（可选，字符串数组）、sourceAssetIds（可选，用于图片编辑或多图合成）",
        },
        targetAssetId: {
          type: "string",
          description: "目标素材ID（重新生成模式）。如果提供，将为该素材生成新版本而非创建新素材。历史版本会保留，用户可在界面切换回滚",
        },
      },
      required: ["assets"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "generate_video_asset",
    description: `生成视频资产（Sora2 Pro，支持 10/15 秒）。

**Grid Storyboard Support**：
Sora2 Pro 可以理解网格分镜图（2x2、2x3、3x3），每个网格对应一个镜头片段。
- 2x2 (4 shots): 标准叙事节奏
- 2x3 (6 shots): 中快节奏，适合对话或中等动作
- 3x3 (9 shots): 快节奏动作，打斗场景，快速情绪变化

**prompt 结构**：[景别] + [主体动作] + [镜头运动] + [镜头参数] + [氛围]

**镜头技术参数（重要）**：
为确保相机运动时背景正确响应（虚化、透视变化），必须包含：
- **焦距**：24mm（广角，保持背景清晰）、50mm（标准）、85mm（人像特写，自然背景虚化）、200mm（长焦，强烈背景虚化）
- **景深**：f/2 shallow depth of field（浅景深，背景虚化）、f/8 deep depth of field（深景深，背景清晰）
- **背景处理**：neutral background bokeh（中性背景虚化）、soft background blur（柔和背景模糊）、atmospheric perspective（大气透视）

**好的 prompt 示例**：
- "Wide establishing shot, village at dawn, 24mm lens, f/8 deep DOF, slow pan left to right, golden morning mist"
- "Medium shot, detective examines clues on desk, 50mm lens, slow push-in, mysterious low-key lighting"
- "Close-up on her trembling hands, 85mm lens, f/2 shallow depth of field, static camera, neutral background bokeh, emotional tension"
- "Full shot, warrior charges forward, 50mm lens, tracking shot from side, dust particles in dramatic backlight"

**Grid Storyboard prompt 示例**：
- "3x3 grid storyboard: martial arts fight sequence. Grid 1: wide shot warriors face off. Grid 2: medium shot warrior charges. Grid 3: close-up determined face. Grid 4-6: rapid action beats (strike, dodge, counter). Grid 7: impact moment. Grid 8: warrior stumbles. Grid 9: reset stance. 50mm lens, dynamic camera movements, dramatic lighting"

**相机运动与背景一致性**：
- 推进特写时：使用 85mm + f/2 + "neutral background bokeh" 确保背景自然虚化
- 拉远全景时：使用 24mm + f/8 + "deep depth of field" 保持背景清晰
- 固定镜头：添加 "locked-off camera remains still" 避免意外运动

**时长选择**：
- 10秒（默认）：标准镜头，适合大多数场景
- 15秒：长镜头，复杂场景，需要更多时间展开的动作

**参数**：
- prompt（必填）：≥10字符，用英文描述
- start_image_url（必填）：起始帧资产ID（可以是网格分镜图）
- end_image_url（可选）：结束帧资产ID，不提供则AI自动生成过渡
- duration（可选）：视频时长，'10'/'15'，默认 '10'
- targetAssetId（可选）：重新生成模式，传入已有视频ID生成新版本
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
          description: "视频时长（可选），'10'/'15' 秒，默认 '10'",
        },
        aspect_ratio: {
          type: "string",
          description: "宽高比（可选），'16:9' 或 '9:16'，默认 '16:9'",
        },
        negative_prompt: {
          type: "string",
          description: "负面提示词（可选），用于避免不想要的内容",
        },
        title: {
          type: "string",
          description: "视频标题（可选），便于识别和管理",
        },
        tags: {
          type: "array",
          description: "标签数组（可选），用于分类和筛选，如 ['开场', '动作', '对话']",
        },
        order: {
          type: "number",
          description: "排序值（可选），用于在视频库中排序",
        },
        targetAssetId: {
          type: "string",
          description: "目标素材ID（重新生成模式）。如果提供，将为该视频素材生成新版本而非创建新素材。历史版本会保留，用户可在界面切换回滚",
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
    name: "set_project_info",
    description: "设置项目信息，包括标题、描述、美术风格。至少需要提供一个字段。设置美术风格前先用 query_context 获取可用风格列表，然后使用风格对象的 id 字段作为 styleId 参数。",
    displayName: "设置项目信息",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "项目标题",
        },
        description: {
          type: "string",
          description: "项目描述",
        },
        styleId: {
          type: "string",
          description: "美术风格的唯一标识符。必须使用 query_context 返回的 artStyles 数组中某个风格对象的 id 字段",
        },
      },
    },
    category: "modification",
    needsConfirmation: true,
  },

  // ============================================
  // 删除类工具（需要确认）
  // ============================================
  {
    name: "delete_asset",
    description: "删除资产（支持单个或批量，同时支持图片、视频、音频和文本素材）。删除后无法恢复，请谨慎使用。适合清理不需要的素材、删除生成失败的资产。",
    displayName: "删除资产",
    parameters: {
      type: "object",
      properties: {
        assetIds: {
          type: "array",
          description: "要删除的资产ID数组（可以是图片、视频、音频或文本的ID）",
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

  // ============================================
  // 时间轴剪辑工具
  // ============================================
  {
    name: "query_timeline",
    description: "查询当前项目的时间轴状态。返回：总时长、片段列表、每个片段的素材详情（ID、名称、prompt、标签、时长、位置等）。执行剪辑前应先调用此函数了解现状。",
    displayName: "查询时间轴",
    parameters: {
      type: "object",
      properties: {},
    },
    category: "read",
    needsConfirmation: false,
  },
  {
    name: "add_clip",
    description:
      "添加素材到时间轴。支持视频轨道(0-99)和音频轨道(100+)。" +
      "不指定trackIndex时根据素材类型自动选择（视频/图片→轨道0，音频→轨道100）。" +
      "音频轨道可通过startTime自由定位实现精确同步。",
    displayName: "添加片段",
    parameters: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "素材ID（必填）",
        },
        trackIndex: {
          type: "number",
          description:
            "轨道索引。视频轨道：0-99，音频轨道：100+。不指定则根据素材类型自动选择",
        },
        duration: {
          type: "number",
          description: "显示时长（毫秒），图片必填，视频/音频可选",
        },
        startTime: {
          type: "number",
          description: "在时间轴上的起始位置（毫秒），音频轨道常用此参数精确定位",
        },
        insertAt: {
          type: "string",
          description:
            "插入位置（视频轨道用）：'end'（默认）|'start'|clipId（在该片段后插入）",
        },
        trimStart: {
          type: "number",
          description: "素材入点（毫秒），默认0",
        },
        trimEnd: {
          type: "number",
          description: "素材出点（毫秒），默认到结尾",
        },
      },
      required: ["assetId"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "remove_clip",
    description: "从时间轴移除片段。视频轨道删除后自动波纹编辑（后续片段自动前移）；音频轨道删除后保持自由定位，不影响其他片段位置。",
    displayName: "移除片段",
    parameters: {
      type: "object",
      properties: {
        clipId: {
          type: "string",
          description: "要移除的片段ID",
        },
      },
      required: ["clipId"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "update_clip",
    description: "更新片段属性。可修改：时长、裁剪点、顺序位置、替换素材。一次调用可修改多个属性。",
    displayName: "更新片段",
    parameters: {
      type: "object",
      properties: {
        clipId: {
          type: "string",
          description: "片段ID（必填）",
        },
        duration: {
          type: "number",
          description: "新时长（毫秒）",
        },
        trimStart: {
          type: "number",
          description: "新入点（毫秒）",
        },
        trimEnd: {
          type: "number",
          description: "新出点（毫秒）",
        },
        moveToPosition: {
          type: "number",
          description: "移动到指定顺序位置（0=最前）",
        },
        replaceWithAssetId: {
          type: "string",
          description: "替换为新素材ID",
        },
      },
      required: ["clipId"],
    },
    category: "modification",
    needsConfirmation: true,
  },
  {
    name: "add_audio_track",
    description:
      "添加新的音频轨道。当需要多条音频同时播放时使用（如背景音乐+音效+对白）。" +
      "默认已有一条音频轨道（索引100），此函数用于添加额外的音频轨道。",
    displayName: "添加音频轨道",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "轨道名称（可选），如'BGM'、'音效'、'对白'",
        },
      },
    },
    category: "modification",
    needsConfirmation: true,
  },

  // ============================================
  // 音频生成工具（需要确认）
  // ============================================
  {
    name: "generate_sound_effect",
    description: `生成音效资产。使用 ElevenLabs Sound Effect V2 生成高质量音效。

## 使用说明

**适用场景：** 脚步声、爆炸声、环境音、UI 音效等

**参数要求：**
- **prompt**（必填）：英文音效描述，如 "footsteps on wooden floor", "thunder rumbling in distance"
- **name**（可选）：资产名称，便于识别
- **duration**（可选）：时长 0.5-22 秒，不指定则自动
- **is_loopable**（可选）：是否生成可循环音效
- **tags**（可选）：标签数组，如 ["音效", "脚步", "室内"]

**示例：**
\`\`\`json
{
  "prompt": "heavy rain on window with distant thunder",
  "name": "暴风雨环境音",
  "duration": 10,
  "is_loopable": true,
  "tags": ["音效", "环境", "雨声"]
}
\`\`\`

**积分消耗：** 1 积分/次`,
    displayName: "生成音效",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "音效描述（必填，英文），详细描述音效内容",
        },
        name: {
          type: "string",
          description: "资产名称（可选），便于识别和管理",
        },
        duration: {
          type: "number",
          description: "音效时长（可选），0.5-22 秒",
        },
        is_loopable: {
          type: "boolean",
          description: "是否可循环（可选），适合背景环境音",
        },
        tags: {
          type: "array",
          description: "标签数组（可选），用于分类和筛选",
          items: { type: "string" },
        },
      },
      required: ["prompt"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "generate_bgm",
    description: `生成背景音乐资产。使用 Suno AI 生成高质量背景音乐。

## 使用说明

**适用场景：** 场景配乐、情绪渲染、片头片尾音乐等

**参数要求：**
- **prompt**（必填）：音乐描述或歌词，描述风格、情绪、节奏
- **name**（可选）：资产名称
- **genre**（可选）：音乐风格，如 "orchestral", "electronic", "jazz"
- **mood**（可选）：情绪氛围，如 "tense", "peaceful", "exciting"
- **instrumental**（可选）：是否纯音乐（无人声），默认 true
- **tags**（可选）：标签数组

**示例：**
\`\`\`json
{
  "prompt": "Epic orchestral music with rising tension, suitable for action scene climax",
  "name": "紧张动作配乐",
  "genre": "orchestral",
  "mood": "tense",
  "instrumental": true,
  "tags": ["BGM", "史诗", "动作"]
}
\`\`\`

**积分消耗：** 10 积分/次`,
    displayName: "生成背景音乐",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "音乐描述（必填），描述风格、情绪、节奏等",
        },
        name: {
          type: "string",
          description: "资产名称（可选）",
        },
        genre: {
          type: "string",
          description: "音乐风格（可选），如 orchestral, electronic, jazz, rock",
        },
        mood: {
          type: "string",
          description: "情绪氛围（可选），如 tense, peaceful, exciting, melancholic",
        },
        instrumental: {
          type: "boolean",
          description: "是否纯音乐（可选），默认 true（无人声）",
        },
        tags: {
          type: "array",
          description: "标签数组（可选）",
          items: { type: "string" },
        },
      },
      required: ["prompt"],
    },
    category: "generation",
    needsConfirmation: true,
  },
  {
    name: "generate_dialogue",
    description: `生成台词配音资产。使用 MiniMax Speech TTS 将文本转换为高质量语音。

## 使用说明

**适用场景：** 角色对白、旁白、画外音等

**参数要求：**
- **text**（必填）：要朗读的文本内容（支持中英文）
- **voice_id**（必填）：音色ID，使用系统预设音色
- **name**（可选）：资产名称，建议包含角色名便于管理
- **emotion**（可选）：情感表达，happy/sad/angry/fearful/neutral 等
- **speed**（可选）：语速 0.5-2.0，默认 1.0
- **pitch**（可选）：音调 -12 到 12，默认 0
- **tags**（可选）：标签数组，建议包含角色名

**可用音色：**
- 男声：青涩青年(male-qn-qingse)、精英男声(male-qn-jingying)、霸道总裁(male-qn-badao)、阳光大学生(male-qn-daxuesheng)、磁性男主播(presenter_male)、沧桑大叔(audiobook_male_1)
- 女声：温柔少女(female-shaonv)、知性御姐(female-yujie)、成熟女性(female-chengshu)、甜美萝莉(female-tianmei)、女主播(presenter_female)、温婉女声(audiobook_female_1)

**示例：**
\`\`\`json
{
  "text": "我终于找到你了，等这一刻已经等了很久。",
  "voice_id": "male-qn-qingse",
  "name": "张三-紧张台词",
  "emotion": "fearful",
  "speed": 0.9,
  "tags": ["台词", "张三", "紧张"]
}
\`\`\`

**注意：** 同一角色的台词应使用相同的 voice_id 以保持一致性。

**积分消耗：** 约 0.6 积分/100字`,
    displayName: "生成台词配音",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "台词文本（必填），支持中英文，建议单次不超过 500 字",
        },
        voice_id: {
          type: "string",
          description: "音色ID（必填），参考可用音色列表",
        },
        name: {
          type: "string",
          description: "资产名称（可选），建议包含角色名",
        },
        emotion: {
          type: "string",
          description: "情感表达（可选）：happy/sad/angry/fearful/disgusted/surprised/neutral",
          enum: ["happy", "sad", "angry", "fearful", "disgusted", "surprised", "neutral"],
        },
        speed: {
          type: "number",
          description: "语速（可选），0.5-2.0，默认 1.0",
        },
        pitch: {
          type: "number",
          description: "音调（可选），-12 到 12，默认 0",
        },
        tags: {
          type: "array",
          description: "标签数组（可选），建议包含角色名如 ['台词', '角色名']",
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
 * 根据名称获取 Function 定义
 */
export function getFunctionDefinition(name: string): FunctionDefinition | undefined {
  return AGENT_FUNCTIONS.find((f) => f.name === name);
}
