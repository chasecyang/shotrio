// Kie.ai 通用任务管理

import { KIE_API_BASE_URL, getKieApiKey } from "./config";

// ============= 任务状态类型 =============

interface CreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface TaskDetailResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    model: string;
    state: "waiting" | "queuing" | "generating" | "success" | "fail";
    param: string;
    resultJson: string;
    failCode?: string;
    failMsg?: string;
    completeTime?: number;
    createTime: number;
    updateTime: number;
  };
}

interface TaskResult {
  resultUrls: string[];
}

// ============= 通用任务函数 =============

/**
 * 创建 Kie.ai 任务
 */
export async function createTask(
  model: string,
  input: Record<string, unknown>,
  callBackUrl?: string
): Promise<string> {
  const apiKey = getKieApiKey();

  const requestBody = {
    model,
    input,
    ...(callBackUrl && { callBackUrl }),
  };

  console.log(`[Kie.ai] 创建任务: ${model}`, JSON.stringify(requestBody, null, 2));

  const response = await fetch(`${KIE_API_BASE_URL}/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Kie.ai] 创建任务失败 (${response.status}):`, error);
    throw new Error(`Kie.ai API failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as CreateTaskResponse;

  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(`Kie.ai 创建任务失败: ${data.msg || "未知错误"}`);
  }

  console.log(`[Kie.ai] 任务已创建: ${data.data.taskId}`);
  return data.data.taskId;
}

/**
 * 查询任务状态
 */
export async function getTaskDetails(
  taskId: string
): Promise<TaskDetailResponse["data"]> {
  const apiKey = getKieApiKey();

  const response = await fetch(
    `${KIE_API_BASE_URL}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Kie.ai] 查询任务失败 (${response.status}):`, error);
    throw new Error(`Kie.ai 查询任务失败: ${response.status} ${error}`);
  }

  const data = (await response.json()) as TaskDetailResponse;

  if (data.code !== 200) {
    throw new Error(`Kie.ai 查询任务失败: ${data.msg || "未知错误"}`);
  }

  return data.data;
}

/**
 * 轮询等待任务完成
 */
export async function waitForTaskCompletion(
  taskId: string,
  maxAttempts = 60,
  interval = 5000
): Promise<string[]> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const taskDetails = await getTaskDetails(taskId);

    console.log(
      `[Kie.ai] 任务状态 [${attempts + 1}/${maxAttempts}]: ${taskDetails.state}`
    );

    if (taskDetails.state === "success") {
      if (!taskDetails.resultJson) {
        throw new Error("任务完成但没有返回结果");
      }

      const result = JSON.parse(taskDetails.resultJson) as TaskResult;
      console.log(`[Kie.ai] 任务完成，生成了 ${result.resultUrls.length} 张图片`);
      return result.resultUrls;
    }

    if (taskDetails.state === "fail") {
      const errorMsg = taskDetails.failMsg || "未知错误";
      console.error(`[Kie.ai] 任务失败: ${errorMsg}`);
      throw new Error(`Kie.ai 任务失败: ${errorMsg}`);
    }

    // 仍在处理中，等待后继续
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Kie.ai 任务超时（已尝试 ${maxAttempts} 次）`);
}
