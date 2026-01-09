import { getChatCompletion } from "./openai.service";

/**
 * AI分析结果
 */
export interface AIAnalysisResult {
  name: string;          // AI生成的描述性名称
  tags: string[];        // 3-5个标签
}

/**
 * 基于prompt分析并生成名称和标签
 * @param prompt 用户输入的生成prompt
 * @returns AI分析结果
 */
export async function analyzePromptForAsset(
  prompt: string
): Promise<AIAnalysisResult> {
  try {
    const systemPrompt = `你是一个图片内容分析专家。你的任务是分析图片生成的prompt，提取画面的关键信息：

1. **名称**（10-30字符，中文）
   - 直接描述画面内容，如"雪山滑雪-运动女性"、"城市夜景-霓虹灯光"
   - 突出主体和关键特征，使用连字符分隔
   - 简洁明了，避免冗长

2. **标签**（3-5个关键词）
   - 第一个标签必须是类型标签，如 角色、场景、道具、特效 等等
   - 提取画面中的主体、动作、场景、风格、色调、情绪等
   - 使用具体、常见的词汇，便于检索
   - 例如：雪山、滑雪、运动、冷色调

返回JSON格式：
{
  "name": "描述性名称",
  "tags": ["标签1", "标签2", "标签3"]
}`;

    const userPrompt = `请分析以下图片prompt生成名称和标签。
Prompt: ${prompt}`;

    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        // 不使用 reasoning，自动使用 OPENAI_CHAT_MODEL (chat 模型)
        temperature: 0.7,
        maxTokens: 1000, // 增加 token 限制以确保完整响应
        jsonMode: true,
      }
    );

    // 解析JSON响应
    const trimmedResponse = response.trim();
    
    const result = JSON.parse(trimmedResponse) as {
      name: string;
      tags: string[];
    };

    // 验证和规范化结果
    const name = result.name?.trim() || generateFallbackName();
    const tags = Array.isArray(result.tags) 
      ? result.tags.slice(0, 5).filter(t => t?.trim()).map(t => t.trim())
      : [];

    // 确保至少有基本标签
    if (tags.length === 0) {
      tags.push("AI生成");
    }

    return {
      name,
      tags,
    };
  } catch (error) {
    console.error("AI分析prompt失败:", error);
    
    // 返回fallback结果
    return {
      name: generateFallbackName(),
      tags: ["AI生成"],
    };
  }
}

/**
 * 为批量生成的图片生成独立名称
 * @param baseName 基础名称
 * @param index 索引（从0开始）
 * @param total 总数
 * @returns 带索引的名称
 */
export function generateIndexedName(
  baseName: string,
  index: number,
  total: number
): string {
  if (total === 1) {
    return baseName;
  }
  
  // 格式：基础名称-01、基础名称-02
  const paddedIndex = String(index + 1).padStart(2, "0");
  return `${baseName}-${paddedIndex}`;
}

/**
 * 生成fallback名称
 */
function generateFallbackName(): string {
  const timestamp = new Date().toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(/\//g, "").replace(/:/g, "").replace(/\s/g, "-");
  
  return `AI生成-${timestamp}`;
}

/**
 * 批量分析多个prompt（用于批量生成）
 * 注意：为了节省API调用，我们只分析一次基础prompt，然后为每张图生成索引名称
 */
export async function analyzePromptForBatch(
  prompt: string,
  numImages: number
): Promise<{
  baseAnalysis: AIAnalysisResult;
  names: string[];
}> {
  const baseAnalysis = await analyzePromptForAsset(prompt);

  const names = Array.from({ length: numImages }, (_, i) =>
    generateIndexedName(baseAnalysis.name, i, numImages)
  );

  return {
    baseAnalysis,
    names,
  };
}

/**
 * 获取媒体类型的中文标签
 */
function getMediaTypeLabel(mediaType: "image" | "video" | "audio"): string {
  switch (mediaType) {
    case "image":
      return "图片";
    case "video":
      return "视频";
    case "audio":
      return "音频";
  }
}

/**
 * 获取媒体类型的默认标签
 */
function getDefaultTagForMediaType(mediaType: "image" | "video" | "audio"): string {
  switch (mediaType) {
    case "image":
      return "参考";
    case "video":
      return "视频";
    case "audio":
      return "音频";
  }
}

/**
 * 基于用户描述分析并生成名称和标签（用于用户上传的素材）
 * @param description 用户输入的描述
 * @param mediaType 媒体类型
 * @returns AI分析结果
 */
export async function analyzeDescriptionForAsset(
  description: string,
  mediaType: "image" | "video" | "audio"
): Promise<AIAnalysisResult> {
  try {
    const mediaLabel = getMediaTypeLabel(mediaType);

    const systemPrompt = `你是一个媒体内容分析专家。你的任务是分析用户对${mediaLabel}素材的描述，提取关键信息：

1. **名称**（10-30字符，中文）
   - 直接描述素材内容，如"雪山滑雪-运动女性"、"城市夜景-霓虹灯光"、"欢快背景音乐-电子风格"
   - 突出主体和关键特征，使用连字符分隔
   - 简洁明了，避免冗长

2. **标签**（3-5个关键词）
   - 第一个标签必须是类型标签：
     - 图片类型：角色、场景、道具、特效、参考
     - 视频类型：视频、片段、动画
     - 音频类型：配音、音效、背景音乐
   - 提取素材中的主体、动作、场景、风格、色调、情绪等
   - 使用具体、常见的词汇，便于检索

返回JSON格式：
{
  "name": "描述性名称",
  "tags": ["类型标签", "标签2", "标签3"]
}`;

    const userPrompt = `请分析以下${mediaLabel}素材描述，生成名称和标签。
描述: ${description}`;

    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 1000,
        jsonMode: true,
      }
    );

    const trimmedResponse = response.trim();
    const result = JSON.parse(trimmedResponse) as {
      name: string;
      tags: string[];
    };

    const name = result.name?.trim() || generateFallbackName();
    const tags = Array.isArray(result.tags)
      ? result.tags.slice(0, 5).filter((t) => t?.trim()).map((t) => t.trim())
      : [];

    if (tags.length === 0) {
      tags.push(getDefaultTagForMediaType(mediaType));
    }

    return { name, tags };
  } catch (error) {
    console.error("AI分析描述失败:", error);
    return {
      name: generateFallbackName(),
      tags: [getDefaultTagForMediaType(mediaType)],
    };
  }
}

/**
 * 生成文本素材的fallback名称
 */
function generateTextFallbackName(): string {
  const timestamp = new Date()
    .toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/\//g, "")
    .replace(/:/g, "")
    .replace(/\s/g, "-");

  return `文本-${timestamp}`;
}

/**
 * 基于用户描述或文本内容分析并生成名称和标签（用于文本素材）
 * @param description 用户输入的描述或文本内容前200字符
 * @returns AI分析结果
 */
export async function analyzeDescriptionForText(
  description: string
): Promise<AIAnalysisResult> {
  try {
    const systemPrompt = `你是一个文本内容分析专家。你的任务是分析用户对文本素材的描述，提取关键信息：

1. **名称**（10-30字符，中文）
   - 直接描述文本内容，如"张三角色小传"、"第一集剧本"、"开场白旁白"
   - 突出主题和关键特征，使用连字符分隔
   - 简洁明了，避免冗长

2. **标签**（3-5个关键词）
   - 第一个标签必须是类型标签：剧本、小传、分镜、旁白、台词、笔记、设定 等
   - 提取文本中的主题、用途、场景等
   - 使用具体、常见的词汇，便于检索

返回JSON格式：
{
  "name": "描述性名称",
  "tags": ["类型标签", "标签2", "标签3"]
}`;

    const userPrompt = `请分析以下文本素材描述，生成名称和标签。
描述: ${description}`;

    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 1000,
        jsonMode: true,
      }
    );

    const trimmedResponse = response.trim();
    const result = JSON.parse(trimmedResponse) as {
      name: string;
      tags: string[];
    };

    const name = result.name?.trim() || generateTextFallbackName();
    const tags = Array.isArray(result.tags)
      ? result.tags
          .slice(0, 5)
          .filter((t) => t?.trim())
          .map((t) => t.trim())
      : [];

    if (tags.length === 0) {
      tags.push("文本");
    }

    return { name, tags };
  } catch (error) {
    console.error("AI分析文本描述失败:", error);
    return {
      name: generateTextFallbackName(),
      tags: ["文本"],
    };
  }
}

