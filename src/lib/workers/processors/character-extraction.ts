"use server";

import db from "@/lib/db";
import { episode, character } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { getChatCompletion } from "@/lib/services/openai.service";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import type {
  Job,
  CharacterExtractionInput,
  CharacterExtractionResult,
} from "@/types/job";
import { verifyProjectOwnership, verifyEpisodeOwnership, INPUT_LIMITS } from "../utils/validation";
import { safeJsonParse } from "../utils/json-parser";

/**
 * 处理角色提取任务
 * 仅提取角色信息，不自动导入到数据库
 * 结果存储在 job.resultData 中，供用户预览和确认导入
 */
export async function processCharacterExtraction(jobData: Job, workerToken: string): Promise<void> {
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

  // 构建AI提示词
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

  // 调用OpenAI API，使用 reasoning 模式深度分析角色
  const response = await getChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.7, // reasoning 模式会忽略此参数
      maxTokens: 32000, // reasoning 模式建议使用更大的 token 限制
      jsonMode: true,
      useReasoning: true, // 启用 DeepSeek reasoning 模式，用于深度理解角色性格和关系
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

