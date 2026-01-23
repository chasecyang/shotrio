/**
 * 云雾 AI 视频生成服务
 *
 * 提供 Sora2 和 Sora2 Pro 模型的视频生成功能
 * - Sora2 API 文档: https://yunwu.apifox.cn/api-358068995
 * - Sora2 Pro API 文档: https://yunwu.apifox.cn/api-358742580
 */

// ============= 类型定义 =============

/**
 * 云雾支持的模型类型
 */
export type YunwuModel = "sora-2" | "sora-2-pro-all" | "veo_3_1-fast-4K";

/**
 * 云雾视频生成请求参数（通用）
 */
export interface YunwuVideoCreateRequest {
  images: string[];           // 图片URL数组
  model: YunwuModel;          // 模型名称
  orientation: "portrait" | "landscape";  // 视频方向
  prompt: string;             // 文本提示词
  size: "large" | "medium" | "small";   // 视频质量
  duration: number;           // 视频时长（秒）
  watermark: boolean;         // 水印控制
  private: boolean;           // 隐私设置
}

/**
 * 云雾 Sora2 Pro 视频生成请求参数（向后兼容）
 */
export interface YunwuSora2CreateRequest {
  images: string[];           // 图片URL数组
  model: "sora-2-pro-all";    // 模型名称
  orientation: "portrait" | "landscape";  // 视频方向
  prompt: string;             // 文本提示词
  size: "large" | "medium";   // 视频质量（large=1080p, medium=720p）
  duration: 15 | 25;          // 视频时长（秒）
  watermark: boolean;         // 水印控制
  private: boolean;           // 隐私设置
}

/**
 * 云雾视频生成响应（通用）
 */
export interface YunwuVideoCreateResponse {
  id: string;                 // 任务ID
  status: string;             // 任务状态
  status_update_time: number; // 状态更新时间戳
}

/**
 * 云雾 Sora2 Pro 视频生成响应（向后兼容）
 */
export interface YunwuSora2CreateResponse {
  id: string;                 // 任务ID
  status: string;             // 任务状态
  status_update_time: number; // 状态更新时间戳
}

/**
 * 云雾视频查询响应（通用）
 */
export interface YunwuVideoQueryResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  status_update_time: number;
  video_url?: string | null;  // 视频URL（完成时返回）
  enhanced_prompt?: string;   // 增强后的提示词
  error?: string;             // 错误信息（失败时返回）
}

/**
 * 云雾 Sora2 Pro 视频查询响应（向后兼容）
 */
export interface YunwuSora2QueryResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  status_update_time: number;
  video_url?: string | null;  // 视频URL（完成时返回）
  enhanced_prompt?: string;   // 增强后的提示词
  error?: string;             // 错误信息（失败时返回）
}

/**
 * 云雾视频生成配置（通用）
 */
export interface YunwuVideoConfig {
  model: YunwuModel;
  prompt: string;
  imageUrls: string[];
  duration: number;
  orientation: "portrait" | "landscape";
  watermark?: boolean;
  private?: boolean;
}

/**
 * 云雾 Sora2 生成配置
 */
export interface YunwuSora2StandardConfig {
  prompt: string;
  imageUrls: string[];
  duration: 10 | 15;
  orientation: "portrait" | "landscape";
  watermark?: boolean;
  private?: boolean;
}

/**
 * 云雾 Sora2 Pro 生成配置（向后兼容）
 */
export interface YunwuSora2Config {
  prompt: string;
  imageUrls: string[];
  duration: 15 | 25;
  orientation: "portrait" | "landscape";
  watermark?: boolean;
  private?: boolean;
}

/**
 * 云雾视频生成结果（通用）
 */
export interface YunwuVideoResult {
  taskId: string;
  videoUrl?: string;
  status: string;
}

/**
 * 云雾 Sora2 Pro 生成结果（向后兼容）
 */
export interface YunwuSora2Result {
  taskId: string;
  videoUrl?: string;
  status: string;
}

/**
 * 云雾 Veo3 视频生成请求参数
 */
export interface YunwuVeo3CreateRequest {
  model: string;              // 模型名称（如 veo_3_1-fast-4K）
  prompt: string;             // 文本提示词
  enhance_prompt?: boolean;   // 自动翻译中文提示词为英文
  enable_upsample?: boolean;  // 启用上采样
  images?: string[];          // 图片URL数组（用于帧控制或组件）
  aspect_ratio?: "16:9" | "9:16";  // 视频宽高比（仅 Veo3 支持）
}

/**
 * 云雾 Veo3 视频生成响应
 */
export interface YunwuVeo3CreateResponse {
  id: string;                 // 任务ID
  status: string;             // 任务状态
  status_update_time: number; // 状态更新时间戳
  enhanced_prompt?: string;   // 增强后的提示词
}

/**
 * 云雾 Veo3 视频查询响应
 */
export interface YunwuVeo3QueryResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  status_update_time: number;
  video_url?: string | null;  // 视频URL（完成时返回）
  enhanced_prompt?: string;   // 增强后的提示词
  error?: string;             // 错误信息（失败时返回）
}

/**
 * 云雾 Veo3 生成配置
 */
export interface YunwuVeo3Config {
  prompt: string;
  imageUrls?: string[];
  aspectRatio?: "16:9" | "9:16";
  enhancePrompt?: boolean;
  enableUpsample?: boolean;
}

/**
 * 云雾 Veo3 生成结果
 */
export interface YunwuVeo3Result {
  taskId: string;
  videoUrl?: string;
  status: string;
  enhancedPrompt?: string;
}

// ============= API 配置 =============

const YUNWU_BASE_URL = "https://yunwu.ai";
const YUNWU_API_ENDPOINT = "/v1/video/create";

/**
 * 获取云雾 API Key
 */
function getYunwuApiKey(): string {
  const apiKey = process.env.YUNWU_API_KEY;
  if (!apiKey) {
    throw new Error("YUNWU_API_KEY 环境变量未设置");
  }
  return apiKey;
}

// ============= API 调用函数（通用） =============

/**
 * 创建云雾视频生成任务（通用）
 */
async function createYunwuVideo(
  config: YunwuVideoConfig
): Promise<YunwuVideoResult> {
  const apiKey = getYunwuApiKey();

  // 根据模型和时长选择分辨率
  let size: "large" | "medium" | "small";
  if (config.model === "sora-2-pro-all") {
    // Sora2 Pro: 15s 支持 1080p (large) 和 720p (medium)，25s 只支持 720p (medium)
    size = config.duration === 25 ? "medium" : "large";
  } else {
    // Sora2: 10s 和 15s 都支持 large 和 small
    size = "large";
  }

  const requestBody: YunwuVideoCreateRequest = {
    images: config.imageUrls,
    model: config.model,
    orientation: config.orientation,
    prompt: config.prompt,
    size,
    duration: config.duration,
    watermark: config.watermark ?? false,
    private: config.private ?? true,
  };

  console.log(`[Yunwu] 创建 ${config.model} 视频生成任务:`, {
    prompt: config.prompt,
    imageCount: config.imageUrls.length,
    duration: config.duration,
    size,
    orientation: config.orientation,
  });

  const response = await fetch(`${YUNWU_BASE_URL}${YUNWU_API_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `云雾 API 请求失败 (${response.status}): ${errorText}`
    );
  }

  const result: YunwuVideoCreateResponse = await response.json();

  console.log("[Yunwu] 任务创建成功:", {
    taskId: result.id,
    status: result.status,
  });

  return {
    taskId: result.id,
    status: result.status,
  };
}

/**
 * 查询云雾视频生成任务状态（通用）
 */
async function queryYunwuVideo(
  taskId: string
): Promise<YunwuVideoQueryResponse> {
  const apiKey = getYunwuApiKey();

  // 使用查询参数传递任务ID
  const queryUrl = `${YUNWU_BASE_URL}/v1/video/query?id=${encodeURIComponent(taskId)}`;

  const response = await fetch(queryUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `云雾 API 查询失败 (${response.status}): ${errorText}`
    );
  }

  const result: YunwuVideoQueryResponse = await response.json();
  return result;
}

/**
 * 等待云雾视频生成完成（通用）
 *
 * @param taskId 任务ID
 * @param maxAttempts 最大轮询次数（默认 180 次，每次间隔 10 秒 = 30 分钟）
 * @param intervalMs 轮询间隔（毫秒，默认 10000ms = 10秒）
 */
async function waitForYunwuVideo(
  taskId: string,
  maxAttempts: number = 180,
  intervalMs: number = 10000
): Promise<YunwuVideoResult> {
  console.log(`[Yunwu] 开始轮询任务状态: ${taskId}`);
  console.log(`[Yunwu] 最大轮询次数: ${maxAttempts}, 间隔: ${intervalMs}ms`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await queryYunwuVideo(taskId);

      console.log(`[Yunwu] 轮询 ${attempt}/${maxAttempts}: ${result.status}`);

      if (result.status === "completed") {
        if (!result.video_url) {
          throw new Error("视频生成完成但未返回视频URL");
        }
        console.log(`[Yunwu] 视频生成成功: ${result.video_url}`);
        return {
          taskId: result.id,
          videoUrl: result.video_url,
          status: result.status,
        };
      }

      if (result.status === "failed") {
        throw new Error(`视频生成失败: ${result.error || "未知错误"}`);
      }

      // 状态为 pending 或 processing，继续等待
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      console.error(`[Yunwu] 轮询出错 (${attempt}/${maxAttempts}):`, error);

      // 如果是最后一次尝试，抛出错误
      if (attempt === maxAttempts) {
        throw error;
      }

      // 否则继续等待
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(
    `视频生成超时：已轮询 ${maxAttempts} 次，任务仍未完成`
  );
}

// ============= Sora2 标准版 API 函数 =============

/**
 * 创建云雾 Sora2 视频生成任务
 */
export async function createYunwuSora2StandardVideo(
  config: YunwuSora2StandardConfig
): Promise<YunwuVideoResult> {
  return createYunwuVideo({
    model: "sora-2",
    prompt: config.prompt,
    imageUrls: config.imageUrls,
    duration: config.duration,
    orientation: config.orientation,
    watermark: config.watermark,
    private: config.private,
  });
}

/**
 * 查询云雾 Sora2 视频生成任务状态
 */
export async function queryYunwuSora2StandardVideo(
  taskId: string
): Promise<YunwuVideoQueryResponse> {
  return queryYunwuVideo(taskId);
}

/**
 * 等待云雾 Sora2 视频生成完成
 */
export async function waitForYunwuSora2StandardVideo(
  taskId: string,
  maxAttempts: number = 180,
  intervalMs: number = 10000
): Promise<YunwuVideoResult> {
  return waitForYunwuVideo(taskId, maxAttempts, intervalMs);
}

/**
 * 生成云雾 Sora2 视频（一站式函数）
 *
 * 创建任务并等待完成
 */
export async function generateYunwuSora2StandardVideo(
  config: YunwuSora2StandardConfig
): Promise<YunwuVideoResult> {
  // 创建任务
  const createResult = await createYunwuSora2StandardVideo(config);

  // 等待完成
  const finalResult = await waitForYunwuSora2StandardVideo(createResult.taskId);

  return finalResult;
}

// ============= Sora2 Pro API 函数（向后兼容） =============

/**
 * 创建云雾 Sora2 Pro 视频生成任务
 */
export async function createYunwuSora2Video(
  config: YunwuSora2Config
): Promise<YunwuSora2Result> {
  return createYunwuVideo({
    model: "sora-2-pro-all",
    prompt: config.prompt,
    imageUrls: config.imageUrls,
    duration: config.duration,
    orientation: config.orientation,
    watermark: config.watermark,
    private: config.private,
  });
}

/**
 * 查询云雾 Sora2 Pro 视频生成任务状态
 */
export async function queryYunwuSora2Video(
  taskId: string
): Promise<YunwuSora2QueryResponse> {
  return queryYunwuVideo(taskId);
}

/**
 * 等待云雾 Sora2 Pro 视频生成完成
 *
 * @param taskId 任务ID
 * @param maxAttempts 最大轮询次数（默认 180 次，每次间隔 10 秒 = 30 分钟）
 * @param intervalMs 轮询间隔（毫秒，默认 10000ms = 10秒）
 */
export async function waitForYunwuSora2Video(
  taskId: string,
  maxAttempts: number = 180,
  intervalMs: number = 10000
): Promise<YunwuSora2Result> {
  return waitForYunwuVideo(taskId, maxAttempts, intervalMs);
}

/**
 * 生成云雾 Sora2 Pro 视频（一站式函数）
 *
 * 创建任务并等待完成
 */
export async function generateYunwuSora2Video(
  config: YunwuSora2Config
): Promise<YunwuSora2Result> {
  // 创建任务
  const createResult = await createYunwuSora2Video(config);

  // 等待完成
  const finalResult = await waitForYunwuSora2Video(createResult.taskId);

  return finalResult;
}

// ============= Veo3 API 函数 =============

/**
 * 创建云雾 Veo3 视频生成任务
 */
export async function createYunwuVeo3Video(
  config: YunwuVeo3Config
): Promise<YunwuVeo3Result> {
  const apiKey = getYunwuApiKey();

  const requestBody: YunwuVeo3CreateRequest = {
    model: "veo_3_1-fast-4K",
    prompt: config.prompt,
    enhance_prompt: config.enhancePrompt ?? true,
    enable_upsample: config.enableUpsample ?? true,
  };

  // 添加可选参数
  if (config.imageUrls && config.imageUrls.length > 0) {
    requestBody.images = config.imageUrls;
  }

  if (config.aspectRatio) {
    requestBody.aspect_ratio = config.aspectRatio;
  }

  console.log("[Yunwu] 创建 Veo3 视频生成任务:", {
    prompt: config.prompt,
    imageCount: config.imageUrls?.length || 0,
    aspectRatio: config.aspectRatio,
    enhancePrompt: requestBody.enhance_prompt,
    enableUpsample: requestBody.enable_upsample,
  });

  const response = await fetch(`${YUNWU_BASE_URL}${YUNWU_API_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `云雾 Veo3 API 请求失败 (${response.status}): ${errorText}`
    );
  }

  const result: YunwuVeo3CreateResponse = await response.json();

  console.log("[Yunwu] Veo3 任务创建成功:", {
    taskId: result.id,
    status: result.status,
    enhancedPrompt: result.enhanced_prompt,
  });

  return {
    taskId: result.id,
    status: result.status,
    enhancedPrompt: result.enhanced_prompt,
  };
}

/**
 * 查询云雾 Veo3 视频生成任务状态
 */
export async function queryYunwuVeo3Video(
  taskId: string
): Promise<YunwuVeo3QueryResponse> {
  const apiKey = getYunwuApiKey();

  // 使用查询参数传递任务ID
  const queryUrl = `${YUNWU_BASE_URL}/v1/video/query?id=${encodeURIComponent(taskId)}`;

  const response = await fetch(queryUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `云雾 Veo3 API 查询失败 (${response.status}): ${errorText}`
    );
  }

  const result: YunwuVeo3QueryResponse = await response.json();
  return result;
}

/**
 * 等待云雾 Veo3 视频生成完成
 *
 * @param taskId 任务ID
 * @param maxAttempts 最大轮询次数（默认 180 次，每次间隔 10 秒 = 30 分钟）
 * @param intervalMs 轮询间隔（毫秒，默认 10000ms = 10秒）
 */
export async function waitForYunwuVeo3Video(
  taskId: string,
  maxAttempts: number = 180,
  intervalMs: number = 10000
): Promise<YunwuVeo3Result> {
  console.log(`[Yunwu] 开始轮询 Veo3 任务状态: ${taskId}`);
  console.log(`[Yunwu] 最大轮询次数: ${maxAttempts}, 间隔: ${intervalMs}ms`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await queryYunwuVeo3Video(taskId);

      console.log(`[Yunwu] Veo3 轮询 ${attempt}/${maxAttempts}: ${result.status}`);

      if (result.status === "completed") {
        if (!result.video_url) {
          throw new Error("Veo3 视频生成完成但未返回视频URL");
        }
        console.log(`[Yunwu] Veo3 视频生成成功: ${result.video_url}`);
        return {
          taskId: result.id,
          videoUrl: result.video_url,
          status: result.status,
          enhancedPrompt: result.enhanced_prompt,
        };
      }

      if (result.status === "failed") {
        throw new Error(`Veo3 视频生成失败: ${result.error || "未知错误"}`);
      }

      // 状态为 pending 或 processing，继续等待
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      console.error(`[Yunwu] Veo3 轮询出错 (${attempt}/${maxAttempts}):`, error);

      // 如果是最后一次尝试，抛出错误
      if (attempt === maxAttempts) {
        throw error;
      }

      // 否则继续等待
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(
    `Veo3 视频生成超时：已轮询 ${maxAttempts} 次，任务仍未完成`
  );
}

/**
 * 生成云雾 Veo3 视频（一站式函数）
 *
 * 创建任务并等待完成
 */
export async function generateYunwuVeo3Video(
  config: YunwuVeo3Config
): Promise<YunwuVeo3Result> {
  // 创建任务
  const createResult = await createYunwuVeo3Video(config);

  // 等待完成
  const finalResult = await waitForYunwuVeo3Video(createResult.taskId);

  return finalResult;
}

