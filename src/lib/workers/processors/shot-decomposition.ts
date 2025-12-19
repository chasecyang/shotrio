"use server";

import db from "@/lib/db";
import { shot } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { getChatCompletion } from "@/lib/services/openai.service";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import type {
  Job,
  ShotDecompositionInput,
  ShotDecompositionResult,
} from "@/types/job";
import { verifyProjectOwnership } from "../utils/validation";
import { safeJsonParse } from "../utils/json-parser";
import { buildShotDecompositionPrompt } from "@/lib/prompts/shot";

/**
 * 处理分镜拆解任务
 * 使用AI分析分镜内容，识别自然拆分点，生成多个子分镜方案
 * 结果存储在 job.resultData 中，供用户预览和确认导入
 */
export async function processShotDecomposition(
  jobData: Job,
  workerToken: string
): Promise<void> {
  const input: ShotDecompositionInput = JSON.parse(jobData.inputData || "{}");
  const { shotId, episodeId } = input;

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

  // 验证输入
  if (!shotId) {
    throw new Error("未指定分镜ID");
  }

  if (!episodeId) {
    throw new Error("未指定剧集ID");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "正在读取分镜信息...",
    },
    workerToken
  );

  // 获取分镜完整信息
  const shotData = await db.query.shot.findFirst({
    where: eq(shot.id, shotId),
    with: {
      dialogues: {
        orderBy: (dialogues, { asc }) => [asc(dialogues.order)],
      },
      imageAsset: true,
    },
  });

  if (!shotData) {
    throw new Error("分镜不存在");
  }

  // 验证分镜是否属于指定剧集
  if (shotData.episodeId !== episodeId) {
    throw new Error("分镜不属于指定剧集");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 30,
      progressMessage: "AI 正在分析分镜内容...",
    },
    workerToken
  );

  // 构建角色信息（从对话中提取角色名）
  const uniqueSpeakers = new Set<string>();
  shotData.dialogues.forEach((d) => {
    if (d.speakerName && d.speakerName.trim()) {
      uniqueSpeakers.add(d.speakerName.trim());
    }
  });
  
  const characters = Array.from(uniqueSpeakers).map((name) => ({
    id: name, // 使用名字作为临时ID
    name: name,
    appearance: undefined,
  }));

  // 构建对话信息
  const dialogues = shotData.dialogues.map((d) => ({
    characterId: d.speakerName || undefined,
    characterName: d.speakerName || undefined,
    text: d.dialogueText,
    order: d.order,
  }));

  // 场景信息不再可用（已移除 scene 表）
  const sceneName = undefined;
  const sceneDescription = undefined;
  const sceneId = undefined;

  // 构建AI Prompt
  const prompt = buildShotDecompositionPrompt({
    shotSize: shotData.shotSize,
    cameraMovement: shotData.cameraMovement || "static",
    visualDescription: shotData.visualDescription || "",
    duration: shotData.duration || 3000,
    characters,
    dialogues,
    sceneName,
    sceneDescription,
    sceneId,
  });

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 50,
      progressMessage: "AI 正在生成拆解方案...",
    },
    workerToken
  );

  // 调用AI API，使用reasoning模式进行深度分析
  const response = await getChatCompletion(
    [{ role: "user", content: prompt }],
    {
      // useReasoning=true 自动使用 OPENAI_REASONING_MODEL
      temperature: 0.3, // 使用较低温度保持结果一致性
      maxTokens: 8000,
      jsonMode: true,
      useReasoning: true, // 启用reasoning模式
    }
  );

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 80,
      progressMessage: "正在解析AI返回结果...",
    },
    workerToken
  );

  // 解析AI返回的JSON
  const aiResult = safeJsonParse(response);

  if (!aiResult || !aiResult.decomposedShots) {
    throw new Error("AI返回结果格式错误");
  }

  // 验证拆解结果
  const decomposedShots = aiResult.decomposedShots;

  if (!Array.isArray(decomposedShots) || decomposedShots.length === 0) {
    throw new Error("AI未能生成有效的拆解方案");
  }

  // 验证每个子分镜的必要字段
  for (const subShot of decomposedShots) {
    if (!subShot.shotSize || !subShot.visualDescription) {
      throw new Error("子分镜缺少必要字段");
    }
  }

  // 构建结果
  type DecomposedShotData = {
    shotSize?: string;
    cameraMovement?: string;
    duration?: number;
    visualDescription?: string;
    visualPrompt?: string;
    audioPrompt?: string;
    characters?: Array<{
      characterId?: string;
      characterImageId?: string;
      position?: string;
      action?: string;
    }>;
    dialogues?: Array<{
      characterId?: string;
      dialogueText?: string;
      emotionTag?: string;
      order?: number;
    }>;
  };

  const result: ShotDecompositionResult = {
    originalShotId: shotId,
    originalOrder: shotData.order,
    decomposedShots: (decomposedShots as DecomposedShotData[]).map((subShot, index: number) => ({
      order: index + 1,
      shotSize: subShot.shotSize,
      cameraMovement: subShot.cameraMovement || "static",
      duration: subShot.duration || 3000,
      visualDescription: subShot.visualDescription,
      visualPrompt: subShot.visualPrompt || subShot.visualDescription,
      audioPrompt: subShot.audioPrompt,
      sceneId: undefined, // 场景系统已废弃
      characters: (subShot.characters || []).map((char) => ({
        characterId: char.characterId,
        characterImageId: char.characterImageId,
        position: char.position,
        action: char.action,
      })),
      dialogues: (subShot.dialogues || []).map((dlg) => ({
        characterId: dlg.characterId,
        dialogueText: dlg.dialogueText,
        emotionTag: dlg.emotionTag || "neutral",
        order: dlg.order || 1,
      })),
    })),
    decomposedCount: decomposedShots.length,
    reasoningExplanation: aiResult.reasoning || "AI已完成分镜拆解分析",
  };

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 95,
      progressMessage: "拆解方案生成完成...",
    },
    workerToken
  );

  // 完成任务
  await completeJob(
    {
      jobId: jobData.id,
      resultData: result,
    },
    workerToken
  );
}

