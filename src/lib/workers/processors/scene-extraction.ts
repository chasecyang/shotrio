"use server";

import db from "@/lib/db";
import { episode } from "@/lib/db/schemas/project";
import { getChatCompletion } from "@/lib/services/openai.service";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import type {
  Job,
  SceneExtractionInput,
  SceneExtractionResult,
} from "@/types/job";
import { verifyProjectOwnership, verifyEpisodeOwnership, INPUT_LIMITS } from "../utils/validation";
import { safeJsonParse } from "../utils/json-parser";

/**
 * 处理场景提取任务
 * 仅提取场景信息，不自动导入到数据库
 * 结果存储在 job.resultData 中，供用户预览和确认导入
 */
export async function processSceneExtraction(jobData: Job, workerToken: string): Promise<void> {
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
  const systemPrompt = `你是场景提取专家，从剧本中识别拍摄场景。

# 任务
提取剧本中的所有拍摄场景，生成适合AI图像生成的场景描述。

# 要求

**场景识别**
- 识别不同的拍摄地点（如"咖啡厅"、"办公室"、"客厅"）
- 相同地点算一个场景

**场景描述**（重要：用于AI图像生成）
- 名称：简短地点名
- 描述：核心视觉元素
  * 空间类型和基本布局
  * 关键物体或特征
  * 光线氛围（如"自然光"、"暖色调灯光"）
  * 避免具体人物、动作、情节细节

**示例**
好的描述："现代咖啡厅，落地窗，木质桌椅，吧台陈列咖啡机和杯具，温暖的黄色灯光，绿植装饰"
避免："李明和小红在咖啡厅争吵，桌上有半杯咖啡，她哭了"

# 输出格式
{
  "scenes": [
    {
      "name": "场景名称",
      "description": "场景视觉描述"
    }
  ]
}`;

  const userPrompt = `请分析以下微短剧剧本，提取所有拍摄场景信息：

${scriptContents}

请严格按照JSON格式返回提取结果。`;

  // 调用OpenAI API，使用 reasoning 模式深度分析场景
  const response = await getChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.7, // reasoning 模式会忽略此参数
      maxTokens: 32000, // reasoning 模式建议使用更大的 token 限制
      jsonMode: true,
      useReasoning: true, // 启用 DeepSeek reasoning 模式，用于深度理解场景空间布局
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

