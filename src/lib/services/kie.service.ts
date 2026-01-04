import { getImageUrl } from "@/lib/storage/r2.service";

// ============= Kie.ai 配置 =============

const KIE_API_BASE_URL = "https://api.kie.ai/api/v1";

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  
  if (!apiKey) {
    throw new Error("KIE_API_KEY is not configured");
  }
  
  return apiKey;
}

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

// ============= 通用任务查询函数 =============

/**
 * 创建 Kie.ai 任务
 */
async function createTask(model: string, input: Record<string, unknown>, callBackUrl?: string): Promise<string> {
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
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Kie.ai] 创建任务失败 (${response.status}):`, error);
    throw new Error(`Kie.ai API failed: ${response.status} ${error}`);
  }

  const data = await response.json() as CreateTaskResponse;
  
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(`Kie.ai 创建任务失败: ${data.msg || "未知错误"}`);
  }

  console.log(`[Kie.ai] 任务已创建: ${data.data.taskId}`);
  return data.data.taskId;
}

/**
 * 查询任务状态
 */
async function getTaskDetails(taskId: string): Promise<TaskDetailResponse["data"]> {
  const apiKey = getKieApiKey();

  const response = await fetch(
    `${KIE_API_BASE_URL}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Kie.ai] 查询任务失败 (${response.status}):`, error);
    throw new Error(`Kie.ai 查询任务失败: ${response.status} ${error}`);
  }

  const data = await response.json() as TaskDetailResponse;
  
  if (data.code !== 200) {
    throw new Error(`Kie.ai 查询任务失败: ${data.msg || "未知错误"}`);
  }

  return data.data;
}

/**
 * 轮询等待任务完成
 */
async function waitForTaskCompletion(
  taskId: string,
  maxAttempts = 60,
  interval = 5000
): Promise<string[]> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const taskDetails = await getTaskDetails(taskId);
    
    console.log(`[Kie.ai] 任务状态 [${attempts + 1}/${maxAttempts}]: ${taskDetails.state}`);

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
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Kie.ai 任务超时（已尝试 ${maxAttempts} 次）`);
}

// ============= 类型定义 =============

export type AspectRatio = 
  | "21:9" | "16:9" | "3:2" | "4:3" | "5:4" 
  | "1:1" 
  | "4:5" | "3:4" | "2:3" | "9:16"
  | "auto";

export type ImageSize = 
  | "1:1" | "9:16" | "16:9" | "3:4" | "4:3" | "3:2" | "2:3" | "5:4" | "4:5" | "21:9" | "auto";

export type OutputFormat = "jpeg" | "png" | "jpg" | "webp";

export interface GeneratedImage {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
}

export interface GenerateImageOutput {
  images: GeneratedImage[];
  description: string;
}

// 文生图输入参数（Nano Banana）
export interface TextToImageInput {
  prompt: string;
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
  sync_mode?: boolean;
}

// 图生图/编辑输入参数（Nano Banana Edit）
export interface ImageToImageInput {
  prompt: string;
  image_urls: string[];  // 最多10张参考图
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
  sync_mode?: boolean;
}

// Nano Banana Pro 输入参数
export interface NanoBananaProInput {
  prompt: string;
  image_input?: string[];  // 最多8张输入图片
  aspect_ratio?: AspectRatio;
  resolution?: "1K" | "2K" | "4K";
  output_format?: "png" | "jpg";
}

// ============= Nano Banana 文生图接口 =============

/**
 * 使用 Kie.ai Nano Banana 模型生成图像（文生图）
 * 价格：约 $0.02/张
 */
export async function generateImage(
  input: TextToImageInput
): Promise<GenerateImageOutput> {
  // 将 AspectRatio 转换为 ImageSize
  const imageSize = input.aspect_ratio === "auto" 
    ? "1:1" 
    : (input.aspect_ratio ?? "1:1");

  // Kie.ai 不支持 webp，转换为 png
  const outputFormat = input.output_format === "webp" 
    ? "png" 
    : (input.output_format ?? "png");

  const taskInput = {
    prompt: input.prompt,
    output_format: outputFormat,
    image_size: imageSize,
  };

  // 创建任务
  const taskId = await createTask("google/nano-banana", taskInput);

  // 等待任务完成
  const imageUrls = await waitForTaskCompletion(taskId);

  // 转换为标准格式
  const images: GeneratedImage[] = imageUrls.map(url => ({ url }));

  return {
    images,
    description: input.prompt,
  };
}

// ============= Nano Banana Edit 图生图接口 =============

/**
 * 使用 Kie.ai Nano Banana Edit 模型编辑/转换图像（图生图）
 * 支持最多10张参考图
 */
export async function editImage(
  input: ImageToImageInput
): Promise<GenerateImageOutput> {
  // 处理图片 URL：如果是 R2 key，转换为公开 URL
  const processedUrls = await Promise.all(
    input.image_urls.map(async (url) => {
      if (!url.startsWith("http")) {
        const publicUrl = getImageUrl(url);
        return publicUrl || url;
      }
      return url;
    })
  );

  // 将 AspectRatio 转换为 ImageSize
  const imageSize = !input.aspect_ratio || input.aspect_ratio === "auto" 
    ? "16:9" 
    : input.aspect_ratio;

  // Kie.ai 不支持 webp，转换为 png
  const outputFormat = input.output_format === "webp" 
    ? "png" 
    : (input.output_format ?? "png");

  const taskInput = {
    prompt: input.prompt,
    image_urls: processedUrls,
    output_format: outputFormat,
    image_size: imageSize,
  };

  // 创建任务
  const taskId = await createTask("google/nano-banana-edit", taskInput);

  // 等待任务完成
  const imageUrls = await waitForTaskCompletion(taskId);

  // 转换为标准格式
  const images: GeneratedImage[] = imageUrls.map(url => ({ url }));

  return {
    images,
    description: input.prompt,
  };
}

// ============= Nano Banana Pro 接口 =============

/**
 * 使用 Kie.ai Nano Banana Pro 模型生成高质量图像
 * 支持 4K 分辨率，更精确的文本渲染
 * 价格：约 $0.12/张（24 credits）
 */
export async function generateImagePro(
  input: NanoBananaProInput
): Promise<GenerateImageOutput> {
  // 处理图片输入（如果有）
  let processedImageInput: string[] | undefined;
  if (input.image_input) {
    processedImageInput = await Promise.all(
      input.image_input.map(async (url) => {
        if (!url.startsWith("http")) {
          const publicUrl = getImageUrl(url);
          return publicUrl || url;
        }
        return url;
      })
    );
  }

  const taskInput = {
    prompt: input.prompt,
    ...(processedImageInput && { image_input: processedImageInput }),
    aspect_ratio: input.aspect_ratio ?? "1:1",
    resolution: input.resolution ?? "2K",
    output_format: input.output_format ?? "png",
  };

  // 创建任务
  const taskId = await createTask("google/nano-banana-pro", taskInput);

  // 等待任务完成
  const imageUrls = await waitForTaskCompletion(taskId);

  // 转换为标准格式
  const images: GeneratedImage[] = imageUrls.map(url => ({ url }));

  return {
    images,
    description: input.prompt,
  };
}

// ============= 兼容性函数 =============

/**
 * 智能选择使用标准版或 Edit 版本
 * 如果提供了参考图则使用 Edit，否则使用标准版
 */
export async function generateImageSmart(
  input: TextToImageInput & Partial<ImageToImageInput>
): Promise<GenerateImageOutput> {
  if (input.image_urls && input.image_urls.length > 0) {
    return editImage({
      prompt: input.prompt,
      image_urls: input.image_urls,
      output_format: input.output_format,
      aspect_ratio: input.aspect_ratio,
    });
  } else {
    return generateImage({
      prompt: input.prompt,
      output_format: input.output_format,
      aspect_ratio: input.aspect_ratio,
    });
  }
}

// ============= Veo 3.1 视频生成类型定义 =============

export type Veo3Model = "veo3" | "veo3_fast";
export type Veo3AspectRatio = "16:9" | "9:16" | "Auto";
export type Veo3GenerationType = 
  | "TEXT_2_VIDEO"                        // 文生视频
  | "FIRST_AND_LAST_FRAMES_2_VIDEO"      // 首尾帧过渡
  | "REFERENCE_2_VIDEO";                  // 参考图生成

/**
 * Veo 3.1 生成视频的响应
 */
export interface Veo3GenerateResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

/**
 * Veo 3.1 视频详情响应
 */
export interface Veo3VideoDetails {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status: "pending" | "processing" | "completed" | "failed";
    videoUrl?: string;
    thumbnailUrl?: string;
    duration?: number;
    error?: string;
  };
}

/**
 * Veo 3.1 生成视频输入参数
 */
export interface Veo3GenerateInput {
  prompt: string;                         // 视频描述（必填）
  imageUrls?: string[];                   // 参考图片URL数组（1-2张）
  model?: Veo3Model;                      // 模型选择（默认 veo3_fast）
  generationType?: Veo3GenerationType;    // 生成类型
  aspectRatio?: Veo3AspectRatio;          // 宽高比（默认16:9）
  seeds?: number;                         // 随机种子（10000-99999）
  callBackUrl?: string;                   // 回调URL
  enableTranslation?: boolean;            // 是否启用提示词翻译（默认true）
  watermark?: string;                     // 水印文字
}

/**
 * Veo 3.1 视频输出
 */
export interface Veo3VideoOutput {
  taskId: string;
  videoUrl?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

// ============= Veo 3.1 API 接口 =============

/**
 * 使用 Veo 3.1 生成视频
 * 
 * 支持三种生成模式：
 * - TEXT_2_VIDEO: 纯文本生成视频
 * - FIRST_AND_LAST_FRAMES_2_VIDEO: 首尾帧过渡（1-2张图片）
 * - REFERENCE_2_VIDEO: 基于参考图生成（1-3张图片，仅支持 veo3_fast 和 16:9）
 * 
 * 价格：Google官方价格的 25%
 * 视频时长：约8秒
 * 
 * @see https://docs.kie.ai/veo3-api/generate-veo-3-video
 */
export async function generateVeo3Video(
  input: Veo3GenerateInput
): Promise<Veo3VideoOutput> {
  const apiKey = getKieApiKey();

  // 处理图片 URL：如果是 R2 key，转换为公开 URL
  let processedImageUrls: string[] | undefined;
  if (input.imageUrls && input.imageUrls.length > 0) {
    processedImageUrls = await Promise.all(
      input.imageUrls.map(async (url) => {
        if (!url.startsWith("http")) {
          const publicUrl = getImageUrl(url);
          return publicUrl || url;
        }
        return url;
      })
    );
  }

  // 自动判断生成类型
  let generationType = input.generationType;
  if (!generationType && processedImageUrls && processedImageUrls.length > 0) {
    // 如果有图片但没指定类型，默认使用 FIRST_AND_LAST_FRAMES_2_VIDEO
    generationType = "FIRST_AND_LAST_FRAMES_2_VIDEO";
  }

  const requestBody = {
    prompt: input.prompt,
    ...(processedImageUrls && { imageUrls: processedImageUrls }),
    model: input.model || "veo3_fast",
    ...(generationType && { generationType }),
    aspectRatio: input.aspectRatio || "16:9",
    ...(input.seeds && { seeds: input.seeds }),
    ...(input.callBackUrl && { callBackUrl: input.callBackUrl }),
    enableTranslation: input.enableTranslation !== false, // 默认true
    ...(input.watermark && { watermark: input.watermark }),
  };

  console.log("[Kie Veo3] 发起视频生成请求:", requestBody);

  const response = await fetch(`${KIE_API_BASE_URL}/veo/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Kie.ai Veo3 API error:", error);
    throw new Error(`Kie.ai Veo3 API failed: ${response.status} ${error}`);
  }

  const data = await response.json() as Veo3GenerateResponse;
  
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(`Veo3 生成失败: ${data.msg || "未知错误"}`);
  }

  console.log("[Kie Veo3] 任务已创建:", data.data.taskId);

  return {
    taskId: data.data.taskId,
    status: "pending",
  };
}

/**
 * 获取 Veo 3.1 视频生成任务详情
 * 
 * @param taskId 任务ID
 */
export async function getVeo3VideoDetails(
  taskId: string
): Promise<Veo3VideoOutput> {
  const apiKey = getKieApiKey();

  const response = await fetch(`${KIE_API_BASE_URL}/veo/details/${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Kie.ai Veo3 详情查询失败:", error);
    throw new Error(`Kie.ai Veo3 详情查询失败: ${response.status} ${error}`);
  }

  const data = await response.json() as Veo3VideoDetails;
  
  if (data.code !== 200) {
    throw new Error(`Veo3 详情查询失败: ${data.msg || "未知错误"}`);
  }

  return {
    taskId: data.data.taskId,
    status: data.data.status,
    videoUrl: data.data.videoUrl,
    error: data.data.error,
  };
}

/**
 * 轮询等待 Veo 3.1 视频生成完成
 * 
 * @param taskId 任务ID
 * @param maxAttempts 最大尝试次数（默认60次，约10分钟）
 * @param interval 轮询间隔（毫秒，默认10秒）
 */
export async function waitForVeo3Video(
  taskId: string,
  maxAttempts = 60,
  interval = 10000
): Promise<Veo3VideoOutput> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const details = await getVeo3VideoDetails(taskId);

    if (details.status === "completed" && details.videoUrl) {
      console.log(`[Kie Veo3] 视频生成完成: ${details.videoUrl}`);
      return details;
    }

    if (details.status === "failed") {
      throw new Error(`Veo3 视频生成失败: ${details.error || "未知错误"}`);
    }

    attempts++;
    console.log(`[Kie Veo3] 等待视频生成... (${attempts}/${maxAttempts})`);
    
    // 等待指定时间后继续轮询
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Veo3 视频生成超时（已尝试 ${maxAttempts} 次）`);
}

