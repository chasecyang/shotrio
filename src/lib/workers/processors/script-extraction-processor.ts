"use server";

import db from "@/lib/db";
import { job as jobSchema } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import { extractElementsFromScript } from "@/lib/services/script-extraction.service";
import type {
  Job,
  ScriptElementExtractionInput,
  ScriptElementExtractionResult,
} from "@/types/job";
import { verifyProjectOwnership } from "../utils/validation";

/**
 * 处理剧本元素提取任务
 */
export async function processScriptElementExtraction(
  jobData: Job,
  workerToken: string
): Promise<void> {
  const input: ScriptElementExtractionInput = JSON.parse(
    jobData.inputData || "{}"
  );
  const { episodeId, scriptContent } = input;

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
  if (!episodeId || !scriptContent) {
    throw new Error("缺少必要的输入参数");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "开始分析剧本...",
    },
    workerToken
  );

  // 调用AI提取服务
  let extractionResult: ScriptElementExtractionResult;
  try {
    extractionResult = await extractElementsFromScript(scriptContent);
  } catch (error) {
    throw new Error(
      `AI提取失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 80,
      progressMessage: `已提取 ${extractionResult.elements.length} 个元素`,
    },
    workerToken
  );

  // 保存结果
  await completeJob(
    {
      jobId: jobData.id,
      resultData: extractionResult,
    },
    workerToken
  );
}

