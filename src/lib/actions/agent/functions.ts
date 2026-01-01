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
    description: `使用 Kling O1 Reference-to-Video API 生成视频资产。

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
- 先用 query_assets 查询可用素材
- 根据素材数量合理分配到 elements 和 image_urls
- 多角度的角色用 elements（需要至少2张图），单图场景用 image_urls
- prompt 要详细且准确

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
  "title": "温室废墟发现魔法石",
  "referenceAssetIds": ["asset-1", "asset-2", "asset-3", "asset-4", "asset-5", "asset-6", "asset-7"],
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
  },
  "tags": ["开场", "发现", "魔法"]
}
\`\`\`
`,
    displayName: "生成视频资产",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "视频标题（可选），便于识别和管理",
        },
        referenceAssetIds: {
          type: "array",
          description: "参考素材ID数组（可选）。这些素材将用于视频生成，需要在 klingO1Config 中引用",
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
        tags: {
          type: "array",
          description: "标签数组（可选），用于分类和筛选，如 ['开场', '动作', '对话']",
        },
        order: {
          type: "number",
          description: "排序值（可选），用于在视频库中排序",
        },
      },
      required: ["klingO1Config"],
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
];

/**
 * 根据名称获取 Function 定义
 */
export function getFunctionDefinition(name: string): FunctionDefinition | undefined {
  return AGENT_FUNCTIONS.find((f) => f.name === name);
}
