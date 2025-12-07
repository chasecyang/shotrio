"use server";

import db from "@/lib/db";
import { episode, character, characterImage, project } from "@/lib/db/schemas/project";
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
import type {
  Job,
  NovelSplitInput,
  NovelSplitResult,
  CharacterExtractionInput,
  CharacterExtractionResult,
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

  const combinedContent = episodes
    .map((ep) => `【${ep.title}】\n${ep.scriptContent || ""}`)
    .join("\n\n");

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 30,
      progressMessage: "AI 正在提取角色...",
    },
    workerToken
  );

  // 使用 OpenAI 提取角色
  const systemPrompt = `你是一位专业的角色设定师。请从提供的剧本中提取出所有重要角色，并为每个角色生成详细的设定。

输出JSON格式：
{
  "characters": [
    {
      "name": "角色名",
      "description": "性格、背景等描述",
      "appearance": "外貌特征描述，用于AI绘图"
    }
  ]
}`;

  const response = await getChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `请从以下剧本中提取角色：\n\n${combinedContent}` },
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
      progress: 70,
      progressMessage: "正在保存角色...",
    },
    workerToken
  );

  const result = JSON.parse(response);
  const characters = result.characters || [];

  const characterIds: string[] = [];
  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const characterId = randomUUID();

    await db.insert(character).values({
      id: characterId,
      projectId: jobData.projectId!,
      name: char.name,
      description: char.description || null,
      appearance: char.appearance || null,
    });

    characterIds.push(characterId);

    const progress = 70 + Math.floor((i / characters.length) * 25);
    await updateJobProgress(
      {
        jobId: jobData.id,
        progress,
        currentStep: i + 1,
        progressMessage: `已保存 ${i + 1}/${characters.length} 个角色`,
      },
      workerToken
    );
  }

  const resultData: CharacterExtractionResult = {
    characterIds,
    characterCount: characters.length,
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
      character: true,
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

  if (!imageRecord.imagePrompt) {
    throw new Error("该造型没有生成描述，无法生成图片");
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
  const stylePrompt = imageRecord.imagePrompt;
  
  const fullPrompt = buildCharacterSheetPrompt({
    characterName: imageRecord.character.name,
    baseAppearance: baseAppearance,
    styleDescription: stylePrompt,
  });

  // 调用 fal.ai 生成图像 - 使用横版比例适配设定图布局
  const result = await generateImagePro({
    prompt: fullPrompt,
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
 * 构建场景图 Prompt
 * 生成专业的场景概念图
 */
function buildScenePrompt(params: {
  sceneName: string;
  sceneDescription: string;
  location: string;
  timeOfDay: string;
  viewLabel: string;
  viewDescription: string;
}): string {
  const { sceneName, sceneDescription, location, timeOfDay, viewLabel, viewDescription } = params;

  const prompt = `Create a cinematic location concept art for ${sceneName}.

Scene Description: ${sceneDescription}.
View: ${viewLabel}. ${viewDescription}.
Setting: ${location}, ${timeOfDay} lighting.

This is an establishing shot of the location for film production. The image should show:
- Professional film production design aesthetic
- Highly detailed environment with clear spatial layout
- Atmospheric lighting that matches the ${timeOfDay} setting
- ${location} environment characteristics
- Cinematic composition suitable for ${viewLabel}
- Rich textures and realistic materials
- Depth and dimension appropriate for the viewing angle

Style Requirements: Cinematic concept art, photorealistic rendering, professional matte painting quality, 8k resolution, masterpiece quality with attention to architectural and environmental details.`;

  return prompt;
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
      scene: true,
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

  // 构建完整 Prompt
  const sceneDescription = imageRecord.scene.description || "";
  const location = imageRecord.scene.location || "interior";
  const timeOfDay = imageRecord.scene.timeOfDay || "day";
  const viewPrompt = imageRecord.imagePrompt;
  
  const fullPrompt = buildScenePrompt({
    sceneName: imageRecord.scene.name,
    sceneDescription: sceneDescription,
    location: location,
    timeOfDay: timeOfDay,
    viewLabel: imageRecord.label,
    viewDescription: viewPrompt,
  });

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

