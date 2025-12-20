"use server";

import db from "@/lib/db";
import { episode, job as jobSchema } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { getChatCompletion } from "@/lib/services/openai.service";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import type {
  Job,
  StoryboardGenerationInput,
  StoryboardGenerationResult,
  StoryboardBasicExtractionInput,
  StoryboardBasicExtractionResult,
} from "@/types/job";
import { verifyProjectOwnership } from "../utils/validation";
import { safeJsonParse } from "../utils/json-parser";
import { createChildJob } from "../utils/job-helpers";

// AI响应的类型定义
interface AIShotResponse {
  order?: number;
  shotSize: string;
  cameraMovement: string;
  duration: number;
  description: string;
  visualPrompt: string;
  audioPrompt?: string;
}

/**
 * 处理剧本自动分镜任务（触发入口）
 * 创建子任务：基础提取
 */
export async function processStoryboardGeneration(jobData: Job, workerToken: string): Promise<void> {
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

  // 创建子任务：基础分镜提取
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
    message: "已创建基础分镜提取任务",
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
 * 处理基础分镜提取任务
 * 提取分镜的基础信息（描述、景别、运镜等）
 */
export async function processStoryboardBasicExtraction(jobData: Job, workerToken: string): Promise<void> {
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
      progressMessage: "AI 正在分析剧本并生成分镜...",
    },
    workerToken
  );

  // 构建AI提示词
  const systemPrompt = `你是一位专业的影视分镜设计师，擅长将剧本转换为详细的分镜脚本。

# 核心任务
将微短剧剧本转换为结构化的分镜序列。每个分镜必须包含完整的拍摄参数和描述信息。

# 关键要求
1. **必须返回有效的 JSON 格式**：输出必须是可解析的 JSON，不要添加任何解释文字
2. **景别多样性**：合理运用远景、中景、特写等不同景别
3. **情绪匹配**：根据情节氛围选择合适的运镜方式和景别
4. **连贯性**：注意镜头之间的逻辑衔接
5. **描述完整**：每个分镜的描述应包含画面内容、角色动作、对话、情绪等所有相关信息

# 景别类型（shotSize）- 必须使用以下值之一
- extreme_long_shot: 大远景（建立环境，展示大场景）
- long_shot: 远景（展示人物与环境关系）
- full_shot: 全景（展示人物全身）
- medium_shot: 中景（展示人物上半身，对话常用）
- close_up: 特写（展示面部表情）
- extreme_close_up: 大特写（展示局部细节）

# 运镜方式（cameraMovement）- 必须使用以下值之一
- static: 固定镜头
- push_in: 推镜头
- pull_out: 拉镜头
- pan_left: 左摇
- pan_right: 右摇
- tilt_up: 上摇
- tilt_down: 下摇
- tracking: 移动跟拍
- crane_up: 升镜头
- crane_down: 降镜头
- orbit: 环绕
- zoom_in: 推焦
- zoom_out: 拉焦
- handheld: 手持

# JSON 输出格式（严格遵循）
{
  "shots": [
    {
      "order": 1,
      "shotSize": "medium_shot",
      "cameraMovement": "static",
      "duration": 5000,
      "description": "李明站在办公室门口，身体微微前倾，双手紧握成拳。他眉头紧锁，目光坚定地看向前方，沉声说道：'我不会让你得逞的。'背景是现代化的玻璃门，冷色调光线从侧面打来。",
      "visualPrompt": "Li Ming, a Chinese man in a business suit, stands at a modern glass office door. His body leans forward with tension, fists clenched. His brows are furrowed and his eyes burn with determination. Cold side lighting creates dramatic shadows. Cinematic atmosphere.",
      "audioPrompt": "轻微的脚步声，办公室环境音"
    }
  ]
}

# 字段说明
- order: 镜头序号（数字，从1开始）
- shotSize: 景别（必须是上面列出的英文值之一）
- cameraMovement: 运镜方式（必须是上面列出的英文值之一）
- duration: 时长（数字，毫秒，建议 3000-8000）
- description: 描述（中文，包含画面内容、角色动作、对话、情绪等）
- visualPrompt: 英文 AI 绘图提示词（完整自然语言句子描述画面）
- audioPrompt: 音效描述（可选）

# 注意事项
1. JSON格式：不要有markdown代码块，不要有解释文字
2. description 字段应包含所有信息：画面、人物、动作、对话、情绪
3. 枚举值准确：shotSize和cameraMovement必须使用精确值
4. visualPrompt质量：用自然语言完整句子描述`;

  const userPrompt = `请将以下微短剧剧本转换为分镜脚本。

【剧集信息】
标题：${episodeData.title}
梗概：${episodeData.summary || "无"}

【剧本内容】
${episodeData.scriptContent}

【输出要求】
1. 将剧本拆分为合理的镜头序列
2. 每个分镜的 description 应完整包含：画面内容、角色动作、对话内容、情绪表现
3. 注意镜头景别的多样性
4. 严格按照 JSON 格式输出

只输出 JSON 格式，不要有任何其他文字。`;

  // 调用AI
  const response = await getChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.5,
      maxTokens: 32000,
      jsonMode: true,
      useReasoning: true,
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
  let aiResult;
  try {
    aiResult = safeJsonParse(response);
    console.log("[分镜提取] AI 返回数据预览:", JSON.stringify(aiResult).substring(0, 200));
  } catch (parseError) {
    console.error("[分镜提取] JSON 解析失败，原始响应:", response.substring(0, 500));
    throw new Error(`AI 返回的数据无法解析为 JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  // 验证结果格式
  if (!aiResult || typeof aiResult !== 'object') {
    throw new Error("AI 返回的数据格式不正确：不是有效的对象");
  }
  
  if (!aiResult.shots) {
    throw new Error("AI 返回的数据格式不正确：缺少 shots 字段");
  }
  
  if (!Array.isArray(aiResult.shots)) {
    throw new Error("AI 返回的数据格式不正确：shots 不是数组");
  }
  
  if (aiResult.shots.length === 0) {
    throw new Error("AI 返回的分镜数量为0，请检查剧本内容是否完整");
  }

  console.log(`[分镜提取] 成功提取 ${aiResult.shots.length} 个分镜`);

  // 标准化分镜数据
  const shots = aiResult.shots.map((shot: AIShotResponse, index: number) => ({
    order: shot.order !== undefined ? shot.order : index + 1,
    shotSize: shot.shotSize || "medium_shot",
    cameraMovement: shot.cameraMovement || "static",
    duration: shot.duration || 5000,
    description: shot.description || "",
    visualPrompt: shot.visualPrompt || "",
    audioPrompt: shot.audioPrompt || null,
  }));

  const resultData: StoryboardBasicExtractionResult = {
    shots,
    shotCount: shots.length,
  };

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 90,
      progressMessage: "分镜提取完成...",
    },
    workerToken
  );

  // 完成任务
  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}
