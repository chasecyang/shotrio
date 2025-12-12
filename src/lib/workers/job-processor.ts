"use server";

import db from "@/lib/db";
import { episode, characterImage, project, sceneImage, scene, character, job as jobSchema, shot } from "@/lib/db/schemas/project";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getChatCompletion } from "@/lib/services/openai.service";
import { generateImagePro, generateImageToVideo } from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import {
  startJob,
  updateJobProgress,
  completeJob,
  failJob,
  createJob,
} from "@/lib/actions/job";
import { getWorkerToken } from "@/lib/workers/auth";
import { buildCharacterSheetPrompt } from "@/lib/prompts/character";
import { generateStylePromptFromDescription } from "@/lib/actions/character/prompt-generation";
import { buildVideoPrompt, getKlingDuration } from "@/lib/utils/motion-prompt";
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
  SceneImageGenerationInput,
  SceneImageGenerationResult,
  StoryboardGenerationInput,
  StoryboardGenerationResult,
  StoryboardBasicExtractionInput,
  StoryboardBasicExtractionResult,
  StoryboardMatchingInput,
  StoryboardMatchingResult,
  ShotVideoGenerationInput,
  ShotVideoGenerationResult,
  BatchVideoGenerationInput,
  BatchVideoGenerationResult,
  FinalVideoExportInput,
  FinalVideoExportResult,
} from "@/types/job";

// 输入验证限制
const INPUT_LIMITS = {
  MAX_CONTENT_LENGTH: 50000, // 小说内容最大 50,000 字符
  MAX_EPISODES: 50, // 最多 50 集
  MIN_EPISODES: 1, // 最少 1 集
  MAX_EPISODE_IDS: 100, // 最多处理 100 个剧集
};

/**
 * 安全的 JSON 解析函数
 * 处理 AI 返回的可能包含格式问题的 JSON
 */
function safeJsonParse(response: string): any {
  try {
    // 尝试直接解析
    return JSON.parse(response);
  } catch (parseError) {
    console.error("[Worker] 初次JSON解析失败，尝试清理数据:", parseError);
    
    // 清理可能的问题：
    // 1. 移除注释（// 和 /* */）
    // 2. 移除控制字符和零宽字符
    // 3. 修复尾随逗号
    let cleanedResponse = response
      // 移除单行注释
      .replace(/\/\/.*$/gm, '')
      // 移除多行注释
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // 移除控制字符（保留换行和制表符）
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // 移除零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // 修复尾随逗号
      .replace(/,(\s*[}\]])/g, '$1')
      .trim();
    
    // 尝试提取JSON对象（如果响应包含其他文本）
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }
    
    try {
      const result = JSON.parse(cleanedResponse);
      console.log("[Worker] 清理后JSON解析成功");
      return result;
    } catch (secondError) {
      console.error("[Worker] 清理后仍然解析失败");
      console.error("[Worker] 原始响应前1000字符:", response.substring(0, 1000));
      console.error("[Worker] 清理后响应前1000字符:", cleanedResponse.substring(0, 1000));
      throw new Error(`JSON解析失败: ${secondError instanceof Error ? secondError.message : String(secondError)}`);
    }
  }
}

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
      case "storyboard_basic_extraction":
        await processStoryboardBasicExtraction(jobData, workerToken);
        break;
      case "storyboard_matching":
        await processStoryboardMatching(jobData, workerToken);
        break;
      case "batch_image_generation":
        await processBatchImageGeneration(jobData, workerToken);
        break;
      case "video_generation":
        await processVideoGeneration(jobData, workerToken);
        break;
      case "shot_video_generation":
        await processShotVideoGeneration(jobData, workerToken);
        break;
      case "batch_video_generation":
        await processBatchVideoGeneration(jobData, workerToken);
        break;
      case "final_video_export":
        await processFinalVideoExport(jobData, workerToken);
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
  const result = safeJsonParse(response);
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
  const result = safeJsonParse(response);

  // 验证结果格式
  if (!result.characters || !Array.isArray(result.characters)) {
    throw new Error("AI返回的数据格式不正确");
  }

  // 定义AI响应数据类型
  interface AICharacterResult {
    name?: string;
    description?: string;
    appearance?: string;
    styles?: Array<{
      label?: string;
      prompt?: string;
    }>;
  }

  // 验证并清理数据
  const validatedCharacters = (result.characters as AICharacterResult[])
    .filter(char => char.name && char.name.trim())
    .map(char => ({
      name: char.name!.trim(),
      description: char.description || "",
      appearance: char.appearance || "",
      styles: (char.styles || [])
        .filter(style => style.label && style.prompt)
        .map(style => ({
          label: style.label!.trim(),
          prompt: style.prompt!.trim(),
        })),
    }))
    .filter(char => char.styles.length > 0); // 只保留有造型的角色

  if (validatedCharacters.length === 0) {
    throw new Error("未能从剧本中提取到有效的角色信息，请确保剧本内容中包含角色描述");
  }

  // 计算统计信息
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
  const result = safeJsonParse(response);

  // 验证结果格式
  if (!result.scenes || !Array.isArray(result.scenes)) {
    throw new Error("AI返回的数据格式不正确");
  }

  // 定义AI响应数据类型
  interface AISceneResult {
    name?: string;
    description?: string;
  }

  // 验证并清理数据
  const validatedScenes = (result.scenes as AISceneResult[])
    .filter(scene => scene.name && scene.name.trim())
    .map(scene => ({
      name: scene.name!.trim(),
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

// AI响应的原始类型定义（用于分镜提取）
interface AICharacterResponse {
  name: string;
  position?: string;
  action?: string;
}

interface AIDialogueResponse {
  characterName?: string;
  text: string;
  emotion?: string;
  order?: number;
}

interface AIShotResponse {
  order?: number;
  shotSize: string;
  cameraMovement: string;
  duration: number;
  visualDescription: string;
  visualPrompt: string;
  audioPrompt?: string;
  sceneName?: string;
  characters?: AICharacterResponse[];
  dialogues?: AIDialogueResponse[];
}

/**
 * 处理剧本自动分镜任务（触发入口）
 * 创建两个子任务：基础提取和匹配
 */
async function processStoryboardGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: StoryboardGenerationInput = JSON.parse(jobData.inputData || "{}");
  const { episodeId } = input;

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

  // 验证 episodeId
  if (!episodeId) {
    throw new Error("未指定剧集");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "正在创建分镜提取任务...",
    },
    workerToken
  );

  // 创建第一步任务：基础分镜提取
  const basicExtractionInput: StoryboardBasicExtractionInput = {
    episodeId,
    parentJobId: jobData.id,
  };

  const basicExtractionResult = await createChildJob({
    userId: jobData.userId,
    projectId: jobData.projectId || undefined,
    type: "storyboard_basic_extraction",
    inputData: basicExtractionInput,
    parentJobId: jobData.id,
  }, workerToken);

  if (!basicExtractionResult.success || !basicExtractionResult.jobId) {
    throw new Error(basicExtractionResult.error || "创建基础提取任务失败");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 50,
      progressMessage: "基础分镜提取任务已创建，等待处理...",
    },
    workerToken
  );

  // 父任务完成，返回子任务信息
  const resultData: StoryboardGenerationResult = {
    childJobIds: [basicExtractionResult.jobId],
    basicExtractionJobId: basicExtractionResult.jobId,
    message: "已创建基础分镜提取任务，完成后将自动进行角色场景匹配",
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
 * 处理基础分镜提取任务（第一步）
 * 只提取分镜的基础信息，不进行角色和场景匹配
 */
async function processStoryboardBasicExtraction(jobData: Job, workerToken: string): Promise<void> {
  const input: StoryboardBasicExtractionInput = JSON.parse(jobData.inputData || "{}");
  const { episodeId } = input;

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

  // 验证 episodeId
  if (!episodeId) {
    throw new Error("未指定剧集");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 5,
      progressMessage: "正在读取剧本内容...",
    },
    workerToken
  );

  // 获取剧集内容
  const episodeData = await db.query.episode.findFirst({
    where: eq(episode.id, episodeId),
  });

  if (!episodeData) {
    throw new Error("剧集不存在");
  }

  if (!episodeData.scriptContent || !episodeData.scriptContent.trim()) {
    throw new Error("剧集没有剧本内容");
  }

  // 验证剧集所有权
  if (jobData.projectId && episodeData.projectId !== jobData.projectId) {
    throw new Error("剧集不属于该项目");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 15,
      progressMessage: "AI 正在分析剧本并生成基础分镜...",
    },
    workerToken
  );

  // 构建简化的AI提示词（不包含匹配逻辑）
  const systemPrompt = `你是一位专业的影视分镜设计师，擅长将剧本转换为详细的分镜脚本。

# 任务目标
将微短剧剧本转换为基础分镜序列，每个分镜包含拍摄参数、画面描述和对话。

# 分镜设计原则
1. **景别多样性**：合理运用远景、中景、特写等不同景别
2. **情绪匹配**：根据情节选择合适的运镜方式
3. **视听语言**：关注画面构图、光影、色调
4. **节奏控制**：每个镜头3-8秒
5. **连贯性**：注意镜头之间的衔接

# 景别类型（shotSize）
- extreme_long_shot: 大远景
- long_shot: 远景
- full_shot: 全景
- medium_shot: 中景
- close_up: 特写
- extreme_close_up: 大特写

# 运镜方式（cameraMovement）
- static: 固定镜头
- push_in: 推镜头
- pull_out: 拉镜头
- pan_left/pan_right: 左右摇
- tilt_up/tilt_down: 上下摇
- tracking: 移动跟拍
- crane_up/crane_down: 升降镜头
- orbit: 环绕
- zoom_in/zoom_out: 变焦
- handheld: 手持

# 输出格式
严格按照以下JSON格式返回：

{
  "shots": [
    {
      "order": 1,
      "shotSize": "medium_shot",
      "cameraMovement": "static",
      "duration": 5000,
      "visualDescription": "李明站在办公室门口，表情凝重",
      "visualPrompt": "A Chinese man in business suit standing at modern office door, serious expression, cinematic lighting, high quality",
      "audioPrompt": "轻微的脚步声，远处的车流声",
      "sceneName": "公司办公室",
      "characters": [
        {
          "name": "李明",
          "position": "center",
          "action": "站立，双手握拳"
        }
      ],
      "dialogues": [
        {
          "characterName": "李明",
          "dialogueText": "我不会让你得逞的。",
          "emotionTag": "angry",
          "order": 1
        }
      ]
    }
  ]
}

# 重要说明
- visualDescription: 中文画面描述，详细、具体
- visualPrompt: 英文AI绘图prompt，包含视觉细节
- audioPrompt: 音效和BGM的描述
- duration: 毫秒为单位，一般3000-8000
- position: left/center/right/foreground/background
- emotionTag: neutral/happy/sad/angry/surprised/fearful/disgusted
- sceneName: 简洁的场景名称，如"咖啡厅"、"办公室"
- characters[].name: 角色名称（只需名字，后续会匹配）
- dialogues[].characterName: 说话人名称（只需名字，后续会匹配）
- 如果某个镜头没有对话，dialogues数组为空
- 如果某个镜头没有角色出现，characters数组为空`;

  const userPrompt = `请将以下微短剧剧本转换为基础分镜脚本：

【剧集信息】
标题：${episodeData.title}
梗概：${episodeData.summary || ""}

【剧本内容】
${episodeData.scriptContent}

请严格按照JSON格式返回分镜脚本。注意：
1. 每个镜头都要包含完整的拍摄参数
2. visualDescription和visualPrompt都要详细、专业
3. 场景名称要简洁明了
4. 只提取角色名称，无需ID`;

  // 调用OpenAI API
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
      progress: 80,
      progressMessage: "正在处理AI提取结果...",
    },
    workerToken
  );

  // 解析JSON响应
  const aiResult = safeJsonParse(response);

  // 验证结果格式
  if (!aiResult.shots || !Array.isArray(aiResult.shots)) {
    throw new Error("AI返回的数据格式不正确");
  }

  // 标准化基础分镜数据
  const basicShots = aiResult.shots.map((shot: AIShotResponse, index: number) => ({
    order: shot.order !== undefined ? shot.order : index + 1,
    shotSize: shot.shotSize || "medium_shot",
    cameraMovement: shot.cameraMovement || "static",
    duration: shot.duration || 5000,
    visualDescription: shot.visualDescription || "",
    visualPrompt: shot.visualPrompt || "",
    audioPrompt: shot.audioPrompt || null,
    sceneName: shot.sceneName || null,
    characters: (shot.characters || []).map((char: AICharacterResponse) => ({
      name: char.name || "",
      position: char.position || "center",
      action: char.action || "",
    })),
    dialogues: (shot.dialogues || []).map((dialogue: AIDialogueResponse, dialogueIndex: number) => ({
      characterName: dialogue.characterName || null,
      dialogueText: dialogue.text || "",
      emotionTag: dialogue.emotion || "neutral",
      order: dialogue.order !== undefined ? dialogue.order : dialogueIndex + 1,
    })),
  }));

  const resultData: StoryboardBasicExtractionResult = {
    shots: basicShots,
    shotCount: basicShots.length,
  };

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 90,
      progressMessage: "基础分镜提取完成，准备创建匹配任务...",
    },
    workerToken
  );

  // 完成第一步任务
  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );

  // 自动创建第二步任务：角色场景匹配
  const matchingInput: StoryboardMatchingInput = {
    episodeId,
    basicExtractionJobId: jobData.id,
    parentJobId: input.parentJobId,
  };

  const matchingResult = await createChildJob({
    userId: jobData.userId,
    projectId: jobData.projectId || undefined,
    type: "storyboard_matching",
    inputData: matchingInput,
    parentJobId: input.parentJobId,
  }, workerToken);

  if (!matchingResult.success) {
    console.error("创建匹配任务失败:", matchingResult.error);
    // 不抛出错误，因为第一步已经成功了
  }
}

/**
 * 处理角色场景匹配任务（第二步）
 * 读取第一步的结果，进行智能匹配
 */
async function processStoryboardMatching(jobData: Job, workerToken: string): Promise<void> {
  const input: StoryboardMatchingInput = JSON.parse(jobData.inputData || "{}");
  const { episodeId, basicExtractionJobId } = input;

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
      progress: 5,
      progressMessage: "正在加载基础分镜数据...",
    },
    workerToken
  );

  // 获取第一步的结果
  const basicExtractionJob = await db.query.job.findFirst({
    where: eq(jobSchema.id, basicExtractionJobId),
  });

  if (!basicExtractionJob || !basicExtractionJob.resultData) {
    throw new Error("找不到基础分镜提取结果");
  }

  const basicResult: StoryboardBasicExtractionResult = JSON.parse(basicExtractionJob.resultData);

  if (!basicResult.shots || basicResult.shots.length === 0) {
    throw new Error("基础分镜数据为空");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 15,
      progressMessage: "正在加载项目场景和角色数据...",
    },
    workerToken
  );

  // 获取剧集数据以验证权限
  const episodeData = await db.query.episode.findFirst({
    where: eq(episode.id, episodeId),
  });

  if (!episodeData) {
    throw new Error("剧集不存在");
  }

  // 获取项目的场景和角色数据
  const projectScenes = await db.query.scene.findMany({
    where: eq(scene.projectId, episodeData.projectId),
    with: { images: true },
  });

  const projectCharacters = await db.query.character.findMany({
    where: eq(character.projectId, episodeData.projectId),
    with: { images: true },
  });

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 30,
      progressMessage: "正在智能匹配场景和角色...",
    },
    workerToken
  );

  // 智能匹配场景和角色
  const matchedShots = basicResult.shots.map((basicShot) => {
    // 匹配场景
    let sceneId: string | undefined;
    let sceneMatchConfidence = 0;

    if (basicShot.sceneName && basicShot.sceneName.trim() && projectScenes.length > 0) {
      const sceneName = basicShot.sceneName.trim();
      // 精确匹配
      const exactMatch = projectScenes.find(
        s => s.name.toLowerCase().trim() === sceneName.toLowerCase()
      );
      if (exactMatch) {
        sceneId = exactMatch.id;
        sceneMatchConfidence = 1.0;
      } else {
        // 模糊匹配
        const fuzzyMatch = projectScenes.find(
          s => s.name.toLowerCase().includes(sceneName.toLowerCase()) ||
               sceneName.toLowerCase().includes(s.name.toLowerCase())
        );
        if (fuzzyMatch) {
          sceneId = fuzzyMatch.id;
          sceneMatchConfidence = 0.7;
        }
      }
    }

    // 匹配角色
    const matchedCharacters = basicShot.characters.map((char) => {
      let characterId: string | undefined;
      let characterImageId: string | undefined;
      let matchConfidence = 0;

      if (char.name && projectCharacters.length > 0) {
        // 精确匹配
        const exactMatch = projectCharacters.find(
          c => c.name.toLowerCase().trim() === char.name.toLowerCase().trim()
        );
        
        if (exactMatch) {
          characterId = exactMatch.id;
          matchConfidence = 1.0;
          // 选择主图或第一个造型
          if (exactMatch.images && exactMatch.images.length > 0) {
            const primaryImage = exactMatch.images.find(img => img.isPrimary);
            characterImageId = primaryImage ? primaryImage.id : exactMatch.images[0].id;
          }
        } else {
          // 模糊匹配
          const fuzzyMatch = projectCharacters.find(
            c => c.name.toLowerCase().includes(char.name.toLowerCase()) ||
                 char.name.toLowerCase().includes(c.name.toLowerCase())
          );
          if (fuzzyMatch) {
            characterId = fuzzyMatch.id;
            matchConfidence = 0.7;
            if (fuzzyMatch.images && fuzzyMatch.images.length > 0) {
              const primaryImage = fuzzyMatch.images.find(img => img.isPrimary);
              characterImageId = primaryImage ? primaryImage.id : fuzzyMatch.images[0].id;
            }
          }
        }
      }

      return {
        name: char.name,
        characterId,
        characterImageId,
        position: char.position,
        action: char.action,
        matchConfidence,
      };
    });

    // 匹配对话中的角色
    const matchedDialogues = basicShot.dialogues.map((dialogue) => {
      let characterId: string | undefined;
      let matchConfidence = 0;

      if (dialogue.characterName && dialogue.characterName.trim() && projectCharacters.length > 0) {
        const characterName = dialogue.characterName.trim();
        const exactMatch = projectCharacters.find(
          c => c.name.toLowerCase().trim() === characterName.toLowerCase()
        );
        
        if (exactMatch) {
          characterId = exactMatch.id;
          matchConfidence = 1.0;
        } else {
          const fuzzyMatch = projectCharacters.find(
            c => c.name.toLowerCase().includes(characterName.toLowerCase()) ||
                 characterName.toLowerCase().includes(c.name.toLowerCase())
          );
          if (fuzzyMatch) {
            characterId = fuzzyMatch.id;
            matchConfidence = 0.7;
          }
        }
      }

      return {
        characterName: dialogue.characterName,
        characterId,
        dialogueText: dialogue.dialogueText,
        emotionTag: dialogue.emotionTag,
        order: dialogue.order,
        matchConfidence,
      };
    });

    return {
      ...basicShot,
      sceneId,
      sceneMatchConfidence,
      characters: matchedCharacters,
      dialogues: matchedDialogues,
    };
  });

  // 计算统计信息
  const matchedSceneCount = matchedShots.filter(s => s.sceneId).length;
  const matchedCharacterCount = new Set(
    matchedShots.flatMap(s => s.characters.map(c => c.characterId).filter(Boolean))
  ).size;

  const resultData: StoryboardMatchingResult = {
    shots: matchedShots,
    shotCount: matchedShots.length,
    matchedSceneCount,
    matchedCharacterCount,
  };

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 95,
      progressMessage: "完成角色场景匹配...",
    },
    workerToken
  );

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );

  // 如果有父任务，更新父任务的结果数据以包含匹配任务ID
  if (input.parentJobId) {
    try {
      const parentJob = await db.query.job.findFirst({
        where: eq(jobSchema.id, input.parentJobId),
      });

      if (parentJob && parentJob.resultData) {
        const parentResult: StoryboardGenerationResult = JSON.parse(parentJob.resultData);
        parentResult.matchingJobId = jobData.id;
        
        await db
          .update(jobSchema)
          .set({ 
            resultData: JSON.stringify(parentResult),
            updatedAt: new Date(),
          })
          .where(eq(jobSchema.id, input.parentJobId));
      }
    } catch (error) {
      console.error("更新父任务失败:", error);
      // 不抛出错误，因为匹配任务已经成功了
    }
  }
}

/**
 * 创建子任务的辅助函数
 */
async function createChildJob(
  params: {
    userId: string;
    projectId?: string;
    type: string;
    inputData: unknown;
    parentJobId?: string;
  },
  workerToken: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const { createJob } = await import("@/lib/actions/job/create");
    return await createJob({
      userId: params.userId,
      projectId: params.projectId,
      type: params.type as any,
      inputData: params.inputData,
      parentJobId: params.parentJobId,
    });
  } catch (error) {
    console.error("创建子任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建子任务失败",
    };
  }
}

/**
 * 处理剧本自动分镜任务（旧版本，保留作为备份）
 * @deprecated 使用新的两步式流程代替
 */
async function processStoryboardGenerationLegacy(jobData: Job, workerToken: string): Promise<void> {
  const input: StoryboardGenerationInput = JSON.parse(jobData.inputData || "{}");
  const { episodeId } = input;

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

  // 验证 episodeId
  if (!episodeId) {
    throw new Error("未指定剧集");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 5,
      progressMessage: "正在读取剧本内容...",
    },
    workerToken
  );

  // 获取剧集内容
  const episodeData = await db.query.episode.findFirst({
    where: eq(episode.id, episodeId),
  });

  if (!episodeData) {
    throw new Error("剧集不存在");
  }

  if (!episodeData.scriptContent || !episodeData.scriptContent.trim()) {
    throw new Error("剧集没有剧本内容");
  }

  // 验证剧集所有权
  if (jobData.projectId && episodeData.projectId !== jobData.projectId) {
    throw new Error("剧集不属于该项目");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "正在加载项目场景和角色数据...",
    },
    workerToken
  );

  // 获取项目的场景和角色数据（用于智能匹配）
  const projectScenes = await db.query.scene.findMany({
    where: eq(scene.projectId, episodeData.projectId),
    with: { images: true },
  });

  const projectCharacters = await db.query.character.findMany({
    where: eq(character.projectId, episodeData.projectId),
    with: { images: true },
  });

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 20,
      progressMessage: "AI 正在分析剧本并生成分镜...",
    },
    workerToken
  );

  // 构建AI提示词
  const systemPrompt = `你是一位专业的影视分镜设计师，擅长将剧本转换为详细的分镜脚本（Shot List）。

# 任务目标
将微短剧剧本转换为完整的分镜序列，每个分镜包含拍摄参数、画面描述、角色动作和对话。

# 分镜设计原则
1. **景别多样性**：合理运用远景、中景、特写等不同景别，避免单调
2. **情绪匹配**：根据情节选择合适的运镜方式（如紧张场景用推镜头、悲伤场景用固定镜头）
3. **视听语言**：关注画面构图、光影、色调，用视觉传达情绪
4. **节奏控制**：每个镜头3-8秒，高潮部分可更短，抒情部分可更长
5. **连贯性**：注意镜头之间的衔接和空间关系

# 景别类型（shotSize）
- extreme_long_shot: 大远景（展现环境全貌）
- long_shot: 远景（展现人物全身和周围环境）
- full_shot: 全景（人物从头到脚完整展现）
- medium_shot: 中景（腰部以上）
- close_up: 特写（肩部以上，突出表情）
- extreme_close_up: 大特写（面部局部或物体细节）

# 运镜方式（cameraMovement）
- static: 固定镜头（稳定、客观）
- push_in: 推镜头（增强紧张感、聚焦）
- pull_out: 拉镜头（展现环境、释放压力）
- pan_left/pan_right: 左右摇（跟随移动、展现空间）
- tilt_up/tilt_down: 上下摇（展现高度、权力关系）
- tracking: 移动跟拍（动感、代入感）
- crane_up/crane_down: 升降镜头（上帝视角、压迫感）
- orbit: 环绕（全方位展现）
- zoom_in/zoom_out: 变焦（突出/弱化重点）
- handheld: 手持（真实感、紧迫感）

# 输出格式
严格按照以下JSON格式返回：

{
  "shots": [
    {
      "order": 1,
      "shotSize": "medium_shot",
      "cameraMovement": "static",
      "duration": 5000,
      "visualDescription": "李明站在办公室门口，表情凝重，背后是落地窗的都市夜景",
      "visualPrompt": "A Chinese man in business suit standing at modern office door, serious expression, floor-to-ceiling windows with city night view in background, cinematic lighting, high quality, detailed, 8k",
      "audioPrompt": "轻微的脚步声，远处的车流声，压抑的背景音乐",
      "sceneName": "公司办公室",
      "characters": [
        {
          "name": "李明",
          "position": "center",
          "action": "站立，双手握拳，表情凝重"
        }
      ],
      "dialogues": [
        {
          "characterName": "李明",
          "text": "我不会让你得逞的。",
          "emotion": "angry",
          "order": 1
        }
      ]
    }
  ]
}

# 重要说明
- visualDescription: 中文画面描述，给制作团队看的，要详细、具体
- visualPrompt: 英文AI绘图prompt，要包含足够的视觉细节和质量标签
- audioPrompt: 音效和BGM的描述，增强氛围
- duration: 以毫秒为单位，一般3000-8000之间
- position: left/center/right/foreground/background
- emotion: neutral/happy/sad/angry/surprised/fearful/disgusted
- 如果某个镜头没有对话，dialogues数组可以为空
- 如果某个镜头没有角色出现（如空镜），characters数组可以为空
- 场景名称要简洁明了，如"咖啡厅"、"办公室"、"主角的家-客厅"等`;

  const userPrompt = `请将以下微短剧剧本转换为专业的分镜脚本：

【剧集信息】
标题：${episodeData.title}
梗概：${episodeData.summary || ""}

【剧本内容】
${episodeData.scriptContent}

${projectScenes.length > 0 ? `\n【项目已有场景】\n${projectScenes.map(s => `- ${s.name}: ${s.description || ""}`).join("\n")}` : ""}

${projectCharacters.length > 0 ? `\n【项目已有角色】\n${projectCharacters.map(c => `- ${c.name}: ${c.description || ""}`).join("\n")}` : ""}

请严格按照JSON格式返回分镜脚本。注意：
1. 每个镜头都要包含完整的拍摄参数
2. visualDescription和visualPrompt都要详细、专业
3. 如果能匹配到已有的场景名称，请使用相同的名称
4. 如果能匹配到已有的角色名称，请使用相同的名称`;

  // 调用OpenAI API
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
      progressMessage: "正在处理AI提取结果...",
    },
    workerToken
  );

  // 解析JSON响应
  const aiResult = safeJsonParse(response);

  // 验证结果格式
  if (!aiResult.shots || !Array.isArray(aiResult.shots)) {
    throw new Error("AI返回的数据格式不正确");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 80,
      progressMessage: "正在智能匹配场景和角色...",
    },
    workerToken
  );

  // 智能匹配场景和角色
  const matchedShots = await Promise.all(
    aiResult.shots.map(async (shot: AIShotResponse, index: number) => {
      // 匹配场景
      let sceneId: string | undefined;
      let sceneMatchConfidence = 0;

      if (shot.sceneName && shot.sceneName.trim() && projectScenes.length > 0) {
        const sceneName = shot.sceneName.trim();
        // 精确匹配
        const exactMatch = projectScenes.find(
          s => s.name.toLowerCase().trim() === sceneName.toLowerCase()
        );
        if (exactMatch) {
          sceneId = exactMatch.id;
          sceneMatchConfidence = 1.0;
        } else {
          // 模糊匹配（简单的包含关系）
          const fuzzyMatch = projectScenes.find(
            s => s.name.toLowerCase().includes(sceneName.toLowerCase()) ||
                 sceneName.toLowerCase().includes(s.name.toLowerCase())
          );
          if (fuzzyMatch) {
            sceneId = fuzzyMatch.id;
            sceneMatchConfidence = 0.7;
          }
        }
      }

      // 匹配角色
      const matchedCharacters = (shot.characters || []).map((char: AICharacterResponse) => {
        let characterId: string | undefined;
        let characterImageId: string | undefined;
        let matchConfidence = 0;

        if (char.name && projectCharacters.length > 0) {
          // 精确匹配角色名称
          const exactMatch = projectCharacters.find(
            c => c.name.toLowerCase().trim() === char.name.toLowerCase().trim()
          );
          
          if (exactMatch) {
            characterId = exactMatch.id;
            matchConfidence = 1.0;

            // 如果角色有多个造型，选择主图或第一个
            if (exactMatch.images && exactMatch.images.length > 0) {
              const primaryImage = exactMatch.images.find(img => img.isPrimary);
              characterImageId = primaryImage ? primaryImage.id : exactMatch.images[0].id;
            }
          } else {
            // 模糊匹配
            const fuzzyMatch = projectCharacters.find(
              c => c.name.toLowerCase().includes(char.name.toLowerCase()) ||
                   char.name.toLowerCase().includes(c.name.toLowerCase())
            );
            if (fuzzyMatch) {
              characterId = fuzzyMatch.id;
              matchConfidence = 0.7;
              if (fuzzyMatch.images && fuzzyMatch.images.length > 0) {
                const primaryImage = fuzzyMatch.images.find(img => img.isPrimary);
                characterImageId = primaryImage ? primaryImage.id : fuzzyMatch.images[0].id;
              }
            }
          }
        }

        return {
          name: char.name || "",
          characterId,
          characterImageId,
          position: char.position || "center",
          action: char.action || "",
          matchConfidence,
        };
      });

      // 匹配对话中的角色
      const matchedDialogues = (shot.dialogues || []).map((dialogue: AIDialogueResponse, dialogueIndex: number) => {
        let characterId: string | undefined;
        let matchConfidence = 0;

        if (dialogue.characterName && dialogue.characterName.trim() && projectCharacters.length > 0) {
          const characterName = dialogue.characterName.trim();
          const exactMatch = projectCharacters.find(
            c => c.name.toLowerCase().trim() === characterName.toLowerCase()
          );
          
          if (exactMatch) {
            characterId = exactMatch.id;
            matchConfidence = 1.0;
          } else {
            const fuzzyMatch = projectCharacters.find(
              c => c.name.toLowerCase().includes(characterName.toLowerCase()) ||
                   characterName.toLowerCase().includes(c.name.toLowerCase())
            );
            if (fuzzyMatch) {
              characterId = fuzzyMatch.id;
              matchConfidence = 0.7;
            }
          }
        }

        return {
          characterName: dialogue.characterName || null,
          characterId,
          dialogueText: dialogue.text || "",
          emotionTag: dialogue.emotion || "neutral",
          order: dialogue.order !== undefined ? dialogue.order : dialogueIndex + 1,
          matchConfidence,
        };
      });

      return {
        order: shot.order !== undefined ? shot.order : index + 1,
        shotSize: shot.shotSize || "medium_shot",
        cameraMovement: shot.cameraMovement || "static",
        duration: shot.duration || 5000,
        visualDescription: shot.visualDescription || "",
        visualPrompt: shot.visualPrompt || "",
        audioPrompt: shot.audioPrompt || null,
        sceneName: shot.sceneName || null,
        sceneId,
        sceneMatchConfidence,
        characters: matchedCharacters,
        dialogues: matchedDialogues,
      };
    })
  );

  // 计算统计信息
  const matchedSceneCount = matchedShots.filter(s => s.sceneId).length;
  const matchedCharacterCount = new Set(
    matchedShots.flatMap(s => s.characters.map((c: { characterId?: string }) => c.characterId).filter(Boolean))
  ).size;

  const resultData: StoryboardGenerationResult = {
    shots: matchedShots,
    shotCount: matchedShots.length,
    matchedSceneCount,
    matchedCharacterCount,
  };

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 95,
      progressMessage: "完成分镜提取...",
    },
    workerToken
  );

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
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
  // 保留旧的接口作为向后兼容
  // 直接调用新的单镜视频生成
  await processShotVideoGeneration(jobData, workerToken);
}

/**
 * 处理单镜视频生成
 */
async function processShotVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: ShotVideoGenerationInput = JSON.parse(jobData.inputData || "{}");
  const { shotId, imageUrl, prompt, duration } = input;

  console.log(`[Worker] 开始生成视频: Shot ${shotId}`);

  await startJob({ jobId: jobData.id }, workerToken);

  try {
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

    // 获取分镜信息
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    if (!imageUrl) {
      throw new Error("分镜图片不存在");
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 20,
        progressMessage: "调用Kling API生成视频...",
      },
      workerToken
    );

    // 调用Kling Video API
    console.log(`[Worker] 调用Kling API: ${imageUrl}`);
    const videoResult = await generateImageToVideo({
      prompt: prompt || "camera movement, cinematic",
      image_url: imageUrl,
      duration: duration || "5",
      generate_audio: true,
    });

    if (!videoResult.video?.url) {
      throw new Error("视频生成失败：未返回视频URL");
    }

    console.log(`[Worker] Kling API返回视频URL: ${videoResult.video.url}`);

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 80,
        progressMessage: "上传视频到存储...",
      },
      workerToken
    );

    // 上传视频到R2
    const uploadResult = await uploadImageFromUrl({
      imageUrl: videoResult.video.url,
      folder: "videos",
      filename: `shot-${shotId}-${Date.now()}.mp4`,
    });

    if (!uploadResult.success || !uploadResult.url) {
      throw new Error("上传视频失败");
    }

    console.log(`[Worker] 视频已上传: ${uploadResult.url}`);

    // 更新分镜记录
    await db
      .update(shot)
      .set({
        videoUrl: uploadResult.url,
        updatedAt: new Date(),
      })
      .where(eq(shot.id, shotId));

    const result: ShotVideoGenerationResult = {
      shotId,
      videoUrl: uploadResult.url,
      duration: parseInt(duration || "5"),
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData: result,
      },
      workerToken
    );

    console.log(`[Worker] 视频生成完成: Shot ${shotId}`);
  } catch (error) {
    console.error(`[Worker] 生成视频失败:`, error);
    throw error;
  }
}

/**
 * 处理批量视频生成
 */
async function processBatchVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: BatchVideoGenerationInput = JSON.parse(jobData.inputData || "{}");
  const { shotIds, concurrency = 3 } = input;

  console.log(`[Worker] 开始批量生成视频: ${shotIds.length} 个分镜`);

  await startJob({ jobId: jobData.id }, workerToken);

  try {
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

    // 获取所有分镜信息
    const shots = await db.query.shot.findMany({
      where: inArray(shot.id, shotIds),
    });

    if (shots.length === 0) {
      throw new Error("未找到要生成的分镜");
    }

    const results: BatchVideoGenerationResult["results"] = [];
    let successCount = 0;
    let failedCount = 0;

    // 为每个分镜创建子任务
    for (let i = 0; i < shots.length; i++) {
      const shotData = shots[i];
      
      await updateJobProgress(
        {
          jobId: jobData.id,
          progress: Math.floor((i / shots.length) * 90),
          currentStep: i + 1,
          progressMessage: `正在生成第 ${i + 1}/${shots.length} 个视频...`,
        },
        workerToken
      );

      try {
        if (!shotData.imageUrl) {
          results.push({
            shotId: shotData.id,
            success: false,
            error: "分镜没有图片",
          });
          failedCount++;
          continue;
        }

        // 创建子任务
        const videoPrompt = buildVideoPrompt({
          visualPrompt: shotData.visualPrompt || undefined,
          cameraMovement: shotData.cameraMovement,
        });

        const childJobResult = await createJob(
          {
            userId: jobData.userId,
            projectId: jobData.projectId || undefined,
            type: "shot_video_generation",
            inputData: {
              shotId: shotData.id,
              imageUrl: shotData.imageUrl,
              prompt: videoPrompt,
              duration: getKlingDuration(shotData.duration || 3000),
            } as ShotVideoGenerationInput,
            parentJobId: jobData.id,
          },
          workerToken
        );

        if (childJobResult.success) {
          results.push({
            shotId: shotData.id,
            success: true,
          });
          successCount++;
        } else {
          results.push({
            shotId: shotData.id,
            success: false,
            error: childJobResult.error,
          });
          failedCount++;
        }
      } catch (error) {
        console.error(`[Worker] 生成视频失败 (Shot ${shotData.id}):`, error);
        results.push({
          shotId: shotData.id,
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        });
        failedCount++;
      }
    }

    const batchResult: BatchVideoGenerationResult = {
      results,
      totalCount: shots.length,
      successCount,
      failedCount,
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData: batchResult,
      },
      workerToken
    );

    console.log(`[Worker] 批量生成完成: ${successCount} 成功, ${failedCount} 失败`);
  } catch (error) {
    console.error(`[Worker] 批量生成视频失败:`, error);
    throw error;
  }
}

/**
 * 处理最终成片导出
 * 注意：这是一个基础实现，生成视频列表文件
 * 实际的FFmpeg合成可以在客户端或使用专门的视频处理服务
 */
async function processFinalVideoExport(jobData: Job, workerToken: string): Promise<void> {
  const input: FinalVideoExportInput = JSON.parse(jobData.inputData || "{}");
  const { episodeId, includeAudio, includeSubtitles, exportQuality } = input;

  console.log(`[Worker] 开始导出成片: Episode ${episodeId}`);

  await startJob({ jobId: jobData.id }, workerToken);

  try {
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
        progressMessage: "加载剧集数据...",
      },
      workerToken
    );

    // 获取剧集所有分镜
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, episodeId),
      with: {
        shots: {
          orderBy: (shots, { asc }) => [asc(shots.order)],
          with: {
            dialogues: {
              orderBy: (dialogues, { asc }) => [asc(dialogues.order)],
            },
          },
        },
      },
    });

    if (!episodeData) {
      throw new Error("剧集不存在");
    }

    // 过滤出有视频的分镜
    const shotsWithVideo = episodeData.shots.filter((s) => s.videoUrl);

    if (shotsWithVideo.length === 0) {
      throw new Error("该剧集没有已生成的视频");
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 30,
        progressMessage: `找到 ${shotsWithVideo.length} 个视频片段...`,
      },
      workerToken
    );

    // 计算总时长
    const totalDuration = shotsWithVideo.reduce((sum, shot) => sum + (shot.duration || 0), 0) / 1000;

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 50,
        progressMessage: "准备导出信息...",
      },
      workerToken
    );

    // 基础实现：返回视频列表供前端处理
    // 在实际生产环境中，这里应该调用FFmpeg进行视频合成
    // 可以使用云函数、Docker容器或专门的视频处理服务
    
    const videoList = shotsWithVideo.map((shot) => ({
      order: shot.order,
      videoUrl: shot.videoUrl!,
      duration: shot.duration || 3000,
      dialogues: shot.dialogues.map((d) => ({
        text: d.dialogueText,
        startTime: d.startTime,
        duration: d.duration,
      })),
    }));

    // TODO: 实际的FFmpeg处理
    // const finalVideoUrl = await processWithFFmpeg({
    //   videos: videoList,
    //   includeAudio,
    //   includeSubtitles,
    //   quality: exportQuality,
    // });

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 90,
        progressMessage: "生成导出信息...",
      },
      workerToken
    );

    const result: FinalVideoExportResult = {
      episodeId,
      videoUrl: "", // 暂时返回空，实际应该是合成后的视频URL
      duration: totalDuration,
      fileSize: 0, // 暂时返回0
      // 返回视频列表供前端使用
      videoList: videoList as any,
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData: result,
      },
      workerToken
    );

    console.log(`[Worker] 导出完成: Episode ${episodeId}, ${shotsWithVideo.length} 个片段`);
  } catch (error) {
    console.error(`[Worker] 导出失败:`, error);
    throw error;
  }
}

