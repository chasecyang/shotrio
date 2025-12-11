"use server";

import db from "@/lib/db";
import { episode, character, characterImage, project, scene, sceneImage } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getChatCompletion } from "@/lib/services/openai.service";
import { generateImagePro } from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import {
  startJob,
  updateJobProgress,
  completeJob,
  failJob,
} from "@/lib/actions/job";
import { getWorkerToken } from "@/lib/workers/auth";
import { buildCharacterSheetPrompt } from "@/lib/prompts/character";
import { generateStylePromptFromDescription } from "@/lib/actions/character/prompt-generation";
import type {
  Job,
  NovelSplitInput,
  NovelSplitResult,
  CharacterExtractionInput,
  CharacterExtractionResult,
  SceneExtractionInput,
  SceneExtractionResult,
  CharacterImageGenerationInput,
  CharacterImageGenerationResult,
} from "@/types/job";

// 输入验证限制
const INPUT_LIMITS = {
  MAX_CONTENT_LENGTH: 50000, // 小说内容最大 50,000 字符
  MAX_EPISODES: 50, // 最多 50 集
  MIN_EPISODES: 1, // 最少 1 集
  MAX_EPISODE_IDS: 100, // 最多处理 100 个剧集
};

/**
 * 验证项目所有权
 */
async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  try {
    const projectData = await db.query.project.findFirst({
      where: and(eq(project.id, projectId), eq(project.userId, userId)),
    });
    return !!projectData;
  } catch (error) {
    console.error("验证项目所有权失败:", error);
    return false;
  }
}

/**
 * 清理和验证文本内容，防止 Prompt Injection
 */
function sanitizeTextInput(text: string, maxLength: number): string {
  if (!text) return "";
  
  // 移除潜在的危险字符和控制字符
  let sanitized = text
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // 移除控制字符
    .trim();
  
  // 限制长度
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * 验证数组中的 ID 是否属于指定项目
 */
async function verifyEpisodeOwnership(
  episodeIds: string[],
  projectId: string
): Promise<boolean> {
  try {
    const episodes = await db.query.episode.findMany({
      where: eq(episode.projectId, projectId),
    });
    
    const projectEpisodeIds = new Set(episodes.map((ep) => ep.id));
    return episodeIds.every((id) => projectEpisodeIds.has(id));
  } catch (error) {
    console.error("验证剧集所有权失败:", error);
    return false;
  }
}

/**
 * 处理单个任务
 */
export async function processJob(jobData: Job): Promise<void> {
  const workerToken = getWorkerToken();
  
  try {
    // 标记任务为处理中
    await startJob(jobData.id, workerToken);

    // 根据任务类型调用对应的处理函数
    switch (jobData.type) {
      case "novel_split":
        await processNovelSplit(jobData, workerToken);
        break;
      case "character_extraction":
        await processCharacterExtraction(jobData, workerToken);
        break;
      case "scene_extraction":
        await processSceneExtraction(jobData, workerToken);
        break;
      case "character_image_generation":
        await processCharacterImageGeneration(jobData, workerToken);
        break;
      case "scene_image_generation":
        await processSceneImageGeneration(jobData, workerToken);
        break;
      case "storyboard_generation":
        await processStoryboardGeneration(jobData, workerToken);
        break;
      case "batch_image_generation":
        await processBatchImageGeneration(jobData, workerToken);
        break;
      case "video_generation":
        await processVideoGeneration(jobData, workerToken);
        break;
      default:
        throw new Error(`未知的任务类型: ${jobData.type}`);
    }
  } catch (error) {
    console.error(`处理任务 ${jobData.id} 失败:`, error);
    await failJob(
      {
        jobId: jobData.id,
        errorMessage: error instanceof Error ? error.message : "处理任务失败",
      },
      workerToken
    );
  }
}

/**
 * 处理小说拆分任务
 */
async function processNovelSplit(jobData: Job, workerToken: string): Promise<void> {
  const input: NovelSplitInput = JSON.parse(jobData.inputData || "{}");
  let { content, maxEpisodes = 20 } = input;

  // 验证项目所有权
  if (jobData.projectId) {
    const hasAccess = await verifyProjectOwnership(
      jobData.projectId,
      jobData.userId
    );
    if (!hasAccess) {
      throw new Error("无权访问该项目");
    }
  }

  // 输入验证和清理
  content = sanitizeTextInput(content, INPUT_LIMITS.MAX_CONTENT_LENGTH);
  if (!content) {
    throw new Error("小说内容为空或无效");
  }

  // 验证 maxEpisodes 范围
  maxEpisodes = Math.min(
    Math.max(INPUT_LIMITS.MIN_EPISODES, maxEpisodes),
    INPUT_LIMITS.MAX_EPISODES
  );

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "正在分析小说内容...",
    },
    workerToken
  );

  // 构建 Prompt
  const systemPrompt = `你是一位金牌短剧编剧，深谙当下爆款微短剧（Short Drama）的创作逻辑。

# 你的目标
将提供的小说内容改编成高质量微短剧剧本。

# 核心创作原则
1. **高信息密度（High Information Density）**：严禁注水！每一集必须有实质性的剧情大幅推进，不要把一场对话拉长成一集。每集至少包含3-4个明确的情节拍或反转。
2. **黄金3秒法则**：每集前3秒必须有强烈的视觉奇观、状态反差或悬念，瞬间抓住用户注意力。
3. **情绪过山车**：每集都要有情绪的高低起伏，结尾必须是"钩子"（Hook），让人欲罢不能。

# 内容细则
- **标题**：10-15字，极具吸引力，强反差/强悬念。
- **梗概**：50字以内，概括核心事件。
- **钩子/亮点**：本集最抓人的点（反转/高潮/悬念）。
- **情节密度**：如果原小说情节较慢，请大刀阔斧地合并章节，确保每集微短剧都有足够的内容量。

# 输出格式
必须返回JSON格式：
{
  "episodes": [
    {
      "order": 1,
      "title": "高概念标题",
      "summary": "剧集梗概",
      "hook": "钩子/亮点",
      "scriptContent": "完整剧本内容"
    }
  ]
}

# 注意事项
- 剧集数量不超过${maxEpisodes}集。
- 确保每一集结尾都是一个强悬念（Cliffhanger）。`;

  const userPrompt = `请将以下小说内容拆分并改编为微短剧：

${content}

请严格按照JSON格式返回拆分结果。`;

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 30,
      progressMessage: "AI 正在拆分剧集...",
    },
    workerToken
  );

  // 调用 OpenAI
  const response = await getChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.7,
      maxTokens: 8000,
      jsonMode: true,
    }
  );

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 70,
      progressMessage: "正在保存剧集...",
    },
    workerToken
  );

  // 解析结果
  const result = JSON.parse(response);
  const episodes = result.episodes || [];

  // 批量创建剧集
  const episodeIds: string[] = [];
  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    const episodeId = randomUUID();

    await db.insert(episode).values({
      id: episodeId,
      projectId: jobData.projectId!,
      title: ep.title || `第${i + 1}集`,
      summary: ep.summary || null,
      hook: ep.hook || null,
      scriptContent: ep.scriptContent || null,
      order: i + 1,
    });

    episodeIds.push(episodeId);

    // 更新进度
    const progress = 70 + Math.floor((i / episodes.length) * 25);
    await updateJobProgress(
      {
        jobId: jobData.id,
        progress,
        currentStep: i + 1,
        progressMessage: `已保存 ${i + 1}/${episodes.length} 集`,
      },
      workerToken
    );
  }

  // 完成任务
  const resultData: NovelSplitResult = {
    episodeIds,
    episodeCount: episodes.length,
  };

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}

/**
 * 处理角色提取任务
 * 仅提取角色信息，不自动导入到数据库
 * 结果存储在 job.resultData 中，供用户预览和确认导入
 */
async function processCharacterExtraction(jobData: Job, workerToken: string): Promise<void> {
  const input: CharacterExtractionInput = JSON.parse(jobData.inputData || "{}");
  const { episodeIds } = input;

  // 验证项目所有权
  if (jobData.projectId) {
    const hasAccess = await verifyProjectOwnership(
      jobData.projectId,
      jobData.userId
    );
    if (!hasAccess) {
      throw new Error("无权访问该项目");
    }
  }

  // 验证 episodeIds
  if (!episodeIds || episodeIds.length === 0) {
    throw new Error("未指定剧集");
  }

  if (episodeIds.length > INPUT_LIMITS.MAX_EPISODE_IDS) {
    throw new Error(`剧集数量超过限制（最多 ${INPUT_LIMITS.MAX_EPISODE_IDS} 个）`);
  }

  // 验证剧集所有权
  if (jobData.projectId) {
    const episodesValid = await verifyEpisodeOwnership(
      episodeIds,
      jobData.projectId
    );
    if (!episodesValid) {
      throw new Error("部分剧集不属于该项目");
    }
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "正在读取剧本内容...",
    },
    workerToken
  );

  // 获取剧集内容
  const episodes = await db.query.episode.findMany({
    where: (episodes, { inArray }) => inArray(episodes.id, episodeIds),
  });

  const scriptContents = episodes
    .filter(ep => ep.scriptContent)
    .map(ep => `【第${ep.order}集：${ep.title}】\n${ep.scriptContent}`)
    .join("\n\n---\n\n");

  if (!scriptContents.trim()) {
    throw new Error("剧集中没有剧本内容");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 30,
      progressMessage: "AI 正在分析并提取角色...",
    },
    workerToken
  );

  // 构建AI提示词 - 与 extraction.ts 中的保持一致
  const systemPrompt = `你是一位专业的角色设计专家，擅长从剧本中提取角色信息并生成图像描述。

# 任务目标
分析提供的微短剧剧本，提取所有主要角色的信息和造型变化。

# 提取要求

1. **角色识别**
   - 识别剧本中所有出现的主要角色（至少出现2次以上）
   - 提取角色的中文名称

2. **基础信息**
   - 性格描述：50字以内，概括角色的核心性格特征
   - 基础外貌：描述固定不变的特征（如发色、瞳色、身高、体型、种族特征等）

3. **造型分析**
   - 分析角色在不同场景下的造型变化
   - 每个角色提取2-5个典型造型
   - 造型应该包含：服装风格、配饰、妆容、情绪状态等可变元素

4. **图像Prompt生成**
   - 为每个造型生成专业的英文图像生成prompt
   - 遵循结构：人物基础特征 + 服装描述 + 场景氛围 + 艺术风格
   - 适合用于Stable Diffusion等AI绘图工具
   - 包含必要的质量标签：如 "high quality, detailed, professional photography"

# 输出格式
严格按照以下JSON格式返回：

{
  "characters": [
    {
      "name": "角色中文名",
      "description": "性格描述（50字以内）",
      "appearance": "基础外貌描述（中文，固定特征）",
      "styles": [
        {
          "label": "造型名称（如：日常装、工作装、晚礼服）",
          "prompt": "详细的英文图像生成prompt"
        }
      ]
    }
  ]
}

# 注意事项
- 只提取主要角色，配角可以忽略
- 造型名称要简洁明了，便于用户识别
- 英文prompt要专业、详细，包含足够的视觉细节
- 如果剧本中没有明确描述外貌，可以根据角色性格和身份合理推测
- 确保JSON格式正确，可以被解析`;

  const userPrompt = `请分析以下微短剧剧本，提取所有主要角色信息：

${scriptContents}

请严格按照JSON格式返回提取结果。`;

  // 调用OpenAI API
  const response = await getChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.7,
      maxTokens: 6000,
      jsonMode: true,
    }
  );

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 80,
      progressMessage: "正在处理提取结果...",
    },
    workerToken
  );

  // 解析JSON响应
  const result = JSON.parse(response);

  // 验证结果格式
  if (!result.characters || !Array.isArray(result.characters)) {
    throw new Error("AI返回的数据格式不正确");
  }

  // 验证并清理数据
  const validatedCharacters = result.characters
    .filter(char => char.name && char.name.trim())
    .map(char => ({
      name: char.name.trim(),
      description: char.description || "",
      appearance: char.appearance || "",
      styles: (char.styles || [])
        .filter(style => style.label && style.prompt)
        .map(style => ({
          label: style.label.trim(),
          prompt: style.prompt.trim(),
        })),
    }))
    .filter(char => char.styles.length > 0); // 只保留有造型的角色

  if (validatedCharacters.length === 0) {
    throw new Error("未能从剧本中提取到有效的角色信息，请确保剧本内容中包含角色描述");
  }

  // 计算统计信息
  const totalStylesCount = validatedCharacters.reduce(
    (sum, char) => sum + char.styles.length,
    0
  );

  const resultData: CharacterExtractionResult = {
    characters: validatedCharacters,
    characterCount: validatedCharacters.length,
  };

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}

/**
 * 处理场景提取任务
 * 仅提取场景信息，不自动导入到数据库
 * 结果存储在 job.resultData 中，供用户预览和确认导入
 */
async function processSceneExtraction(jobData: Job, workerToken: string): Promise<void> {
  const input: SceneExtractionInput = JSON.parse(jobData.inputData || "{}");
  const { episodeIds } = input;

  // 验证项目所有权
  if (jobData.projectId) {
    const hasAccess = await verifyProjectOwnership(
      jobData.projectId,
      jobData.userId
    );
    if (!hasAccess) {
      throw new Error("无权访问该项目");
    }
  }

  // 验证 episodeIds
  if (!episodeIds || episodeIds.length === 0) {
    throw new Error("未指定剧集");
  }

  if (episodeIds.length > INPUT_LIMITS.MAX_EPISODE_IDS) {
    throw new Error(`剧集数量超过限制（最多 ${INPUT_LIMITS.MAX_EPISODE_IDS} 个）`);
  }

  // 验证剧集所有权
  if (jobData.projectId) {
    const episodesValid = await verifyEpisodeOwnership(
      episodeIds,
      jobData.projectId
    );
    if (!episodesValid) {
      throw new Error("部分剧集不属于该项目");
    }
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "正在读取剧本内容...",
    },
    workerToken
  );

  // 获取剧集内容
  const episodes = await db.query.episode.findMany({
    where: (episodes, { inArray }) => inArray(episodes.id, episodeIds),
  });

  const scriptContents = episodes
    .filter(ep => ep.scriptContent)
    .map(ep => `【第${ep.order}集：${ep.title}】\n${ep.scriptContent}`)
    .join("\n\n---\n\n");

  if (!scriptContents.trim()) {
    throw new Error("剧集中没有剧本内容");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 30,
      progressMessage: "AI 正在分析并提取场景...",
    },
    workerToken
  );

  // 构建AI提示词
  const systemPrompt = `你是一位专业的场景设计专家，擅长从剧本中提取拍摄场景信息。

# 任务目标
分析提供的微短剧剧本，提取所有不同的拍摄场景/地点。

# 提取要求

1. **场景识别**
   - 识别剧本中所有出现的不同拍摄场景/地点
   - 场景应该是具体的地点，如"咖啡厅"、"办公室"、"主角的家-客厅"等
   - 相同地点算作一个场景

2. **场景信息**
   - 场景名称：简洁明了的地点名称（15字以内）
   - 场景描述：详细描述场景的环境特征、氛围、关键道具、光线等（100-200字）

3. **描述要点**
   - 包含场景的空间布局特征
   - 包含环境氛围（如：温馨、紧张、浪漫等）
   - 包含关键道具和装饰元素
   - 包含光线和色调特征
   - 适合用于AI生成场景参考图

# 输出格式
严格按照以下JSON格式返回：

{
  "scenes": [
    {
      "name": "场景名称",
      "description": "详细的场景描述，包含环境特征、氛围、道具、光线等"
    }
  ]
}

# 注意事项
- 只提取明确出现的场景，不要臆测
- 场景名称要简洁，便于识别和管理
- 场景描述要详细具体，便于后续生成场景图片
- 相同地点的不同时间/天气算作同一场景
- 确保JSON格式正确，可以被解析`;

  const userPrompt = `请分析以下微短剧剧本，提取所有拍摄场景信息：

${scriptContents}

请严格按照JSON格式返回提取结果。`;

  // 调用OpenAI API
  const response = await getChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.7,
      maxTokens: 4000,
      jsonMode: true,
    }
  );

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 80,
      progressMessage: "正在处理提取结果...",
    },
    workerToken
  );

  // 解析JSON响应
  const result = JSON.parse(response);

  // 验证结果格式
  if (!result.scenes || !Array.isArray(result.scenes)) {
    throw new Error("AI返回的数据格式不正确");
  }

  // 验证并清理数据
  const validatedScenes = result.scenes
    .filter(scene => scene.name && scene.name.trim())
    .map(scene => ({
      name: scene.name.trim(),
      description: scene.description || "",
    }))
    .filter(scene => scene.description); // 只保留有描述的场景

  if (validatedScenes.length === 0) {
    throw new Error("未能从剧本中提取到有效的场景信息，请确保剧本内容中包含场景描述");
  }

  const resultData: SceneExtractionResult = {
    scenes: validatedScenes,
    sceneCount: validatedScenes.length,
  };

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}


/**
 * 处理角色造型生成任务
 * 为已有的造型（characterImage）生成图片
 */
async function processCharacterImageGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: CharacterImageGenerationInput = JSON.parse(
    jobData.inputData || "{}"
  );
  const { characterId, imageId, regenerate = false } = input;

  // 验证项目所有权
  if (jobData.projectId) {
    const hasAccess = await verifyProjectOwnership(
      jobData.projectId,
      jobData.userId
    );
    if (!hasAccess) {
      throw new Error("无权访问该项目");
    }
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "正在读取造型信息...",
    },
    workerToken
  );

  // 获取造型信息（包含角色信息）
  const imageRecord = await db.query.characterImage.findFirst({
    where: eq(characterImage.id, imageId),
    with: {
      character: {
        with: {
          project: {
            with: {
              artStyle: true, // 关联查询项目的美术风格
            },
          },
        },
      },
    },
  });

  if (!imageRecord) {
    throw new Error("造型不存在");
  }

  if (imageRecord.character.id !== characterId) {
    throw new Error("造型与角色不匹配");
  }

  // 验证角色是否属于该项目
  if (jobData.projectId && imageRecord.character.projectId !== jobData.projectId) {
    throw new Error("角色不属于该项目");
  }

  // 如果没有造型描述，自动生成
  let finalImagePrompt = imageRecord.imagePrompt;
  if (!finalImagePrompt) {
    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 15,
        progressMessage: "造型描述为空，正在自动生成...",
      },
      workerToken
    );

    console.log(`造型 ${imageId} 没有描述，开始自动生成...`);
    
    // 使用造型名称作为简单描述来生成专业prompt
    const description = imageRecord.label || "default style";
    const generateResult = await generateStylePromptFromDescription(
      characterId,
      description
    );

    if (!generateResult.success || !generateResult.prompt) {
      throw new Error(
        `自动生成造型描述失败: ${generateResult.error || "未知错误"}`
      );
    }

    finalImagePrompt = generateResult.prompt;

    // 保存生成的描述到数据库
    await db
      .update(characterImage)
      .set({ imagePrompt: finalImagePrompt })
      .where(eq(characterImage.id, imageId));

    console.log(`造型描述已自动生成并保存: ${finalImagePrompt.substring(0, 100)}...`);
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 20,
      progressMessage: regenerate ? "正在重新生成图片..." : "正在生成图片...",
    },
    workerToken
  );

  // 构建完整 Prompt - 使用专业的角色设定图 Prompt
  const baseAppearance = imageRecord.character.appearance || "";
  const stylePrompt = finalImagePrompt; // 使用自动生成的或原有的描述
  
  const fullPrompt = buildCharacterSheetPrompt({
    characterName: imageRecord.character.name,
    baseAppearance: baseAppearance,
    styleDescription: stylePrompt,
  });

  // 获取全局美术风格prompt（优先使用styleId关联的风格，fallback到stylePrompt）
  const globalStylePrompt = imageRecord.character.project?.artStyle?.prompt 
    || imageRecord.character.project?.stylePrompt 
    || "";
  
  // 将全局风格追加到完整prompt
  const finalPromptWithStyle = globalStylePrompt 
    ? `${fullPrompt}, ${globalStylePrompt}` 
    : fullPrompt;

  // 调用 fal.ai 生成图像 - 使用横版比例适配设定图布局
  const result = await generateImagePro({
    prompt: finalPromptWithStyle,
    num_images: 1,
    aspect_ratio: "16:9", // 横版设定图，适合展示三视图和多元素
    resolution: "2K",
    output_format: "png",
  });

  if (!result.images || result.images.length === 0) {
    throw new Error("生成失败，没有返回图片");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 70,
      progressMessage: "正在上传图片...",
    },
    workerToken
  );

  // 获取生成的图片
  const generatedImage = result.images[0];
  const imageUrl = generatedImage.url;
  // seed 可能不存在，设为 null
  const seed = null;

  // 上传到 R2（可选，如果需要持久化存储）
  let finalImageUrl = imageUrl;
  try {
    const uploadResult = await uploadImageFromUrl(imageUrl, undefined, jobData.userId);
    if (uploadResult.success && uploadResult.url) {
      finalImageUrl = uploadResult.url;
    }
  } catch (error) {
    console.error("上传图片到 R2 失败，使用原始 URL:", error);
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 90,
      progressMessage: "正在保存图片...",
    },
    workerToken
  );

  // 更新数据库中的 imageUrl 和 seed
  await db
    .update(characterImage)
    .set({
      imageUrl: finalImageUrl,
      seed,
    })
    .where(eq(characterImage.id, imageId));

  const resultData: CharacterImageGenerationResult = {
    imageId,
    imageUrl: finalImageUrl,
  };

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}

/**
 * 处理场景视角生成任务
 * 为已有的场景视角（sceneImage）生成图片
 */
async function processSceneImageGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: SceneImageGenerationInput = JSON.parse(
    jobData.inputData || "{}"
  );
  const { sceneId, imageId, regenerate = false } = input;

  // 验证项目所有权
  if (jobData.projectId) {
    const hasAccess = await verifyProjectOwnership(
      jobData.projectId,
      jobData.userId
    );
    if (!hasAccess) {
      throw new Error("无权访问该项目");
    }
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "正在读取场景信息...",
    },
    workerToken
  );

  // 获取场景视角信息（包含场景信息）
  const imageRecord = await db.query.sceneImage.findFirst({
    where: eq(sceneImage.id, imageId),
    with: {
      scene: {
        with: {
          project: {
            with: {
              artStyle: true, // 关联查询项目的美术风格
            },
          },
        },
      },
    },
  });

  if (!imageRecord) {
    throw new Error("场景视角不存在");
  }

  if (imageRecord.scene.id !== sceneId) {
    throw new Error("视角与场景不匹配");
  }

  // 验证场景是否属于该项目
  if (jobData.projectId && imageRecord.scene.projectId !== jobData.projectId) {
    throw new Error("场景不属于该项目");
  }

  if (!imageRecord.imagePrompt) {
    throw new Error("该视角没有生成描述，无法生成图片");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 20,
      progressMessage: regenerate ? "正在重新生成图片..." : "正在生成图片...",
    },
    workerToken
  );

  // 使用已保存的 imagePrompt（在创建任务时已经构建好）
  const basePrompt = imageRecord.imagePrompt;

  // 获取全局美术风格prompt（优先使用styleId关联的风格，fallback到stylePrompt）
  const globalStylePrompt = imageRecord.scene.project?.artStyle?.prompt 
    || imageRecord.scene.project?.stylePrompt 
    || "";
  
  // 将全局风格追加到基础prompt
  const fullPrompt = globalStylePrompt 
    ? `${basePrompt}, ${globalStylePrompt}` 
    : basePrompt;

  // 调用 fal.ai 生成图像 - 使用横版比例适配场景图
  const result = await generateImagePro({
    prompt: fullPrompt,
    num_images: 1,
    aspect_ratio: "16:9", // 横版场景图
    resolution: "2K",
    output_format: "png",
  });

  if (!result.images || result.images.length === 0) {
    throw new Error("生成失败，没有返回图片");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 70,
      progressMessage: "正在上传图片...",
    },
    workerToken
  );

  // 获取生成的图片
  const generatedImage = result.images[0];
  const imageUrl = generatedImage.url;
  const seed = null;

  // 上传到 R2
  let finalImageUrl = imageUrl;
  try {
    const uploadResult = await uploadImageFromUrl(imageUrl, undefined, jobData.userId);
    if (uploadResult.success && uploadResult.url) {
      finalImageUrl = uploadResult.url;
    }
  } catch (error) {
    console.error("上传图片到 R2 失败，使用原始 URL:", error);
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 90,
      progressMessage: "正在保存图片...",
    },
    workerToken
  );

  // 更新数据库中的 imageUrl 和 seed
  await db
    .update(sceneImage)
    .set({
      imageUrl: finalImageUrl,
      seed,
    })
    .where(eq(sceneImage.id, imageId));

  const resultData: SceneImageGenerationResult = {
    imageId,
    imageUrl: finalImageUrl,
  };

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}

/**
 * 处理剧本自动分镜任务
 */
async function processStoryboardGeneration(jobData: Job, workerToken: string): Promise<void> {
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "功能开发中...",
    },
    workerToken
  );

  // TODO: 实现剧本自动分镜逻辑

  await completeJob(
    {
      jobId: jobData.id,
      resultData: { message: "功能开发中" },
    },
    workerToken
  );
}

/**
 * 处理批量图像生成任务
 */
async function processBatchImageGeneration(jobData: Job, workerToken: string): Promise<void> {
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "功能开发中...",
    },
    workerToken
  );

  // TODO: 实现批量图像生成逻辑

  await completeJob(
    {
      jobId: jobData.id,
      resultData: { message: "功能开发中" },
    },
    workerToken
  );
}

/**
 * 处理视频生成任务
 */
async function processVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "功能开发中...",
    },
    workerToken
  );

  // TODO: 实现视频生成逻辑

  await completeJob(
    {
      jobId: jobData.id,
      resultData: { message: "功能开发中" },
    },
    workerToken
  );
}

