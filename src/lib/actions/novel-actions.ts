"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { project, episode } from "@/lib/db/schemas/project";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getChatCompletion } from "@/lib/services/openai.service";
import { createJob } from "@/lib/actions/job-actions";
import type { 
  NovelSplitResult, 
  NovelImportOptions, 
  NovelEpisodeData 
} from "@/types/project";
import type { NovelSplitInput } from "@/types/job";

// PDF和DOCX解析库（需要npm install pdf-parse mammoth）
import mammoth from "mammoth";

/**
 * 解析上传的文件内容，返回纯文本
 */
export async function parseNovelFile(file: File): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let content = "";

    if (fileName.endsWith(".txt")) {
      // 处理 TXT 文件
      content = buffer.toString("utf-8");
    } else if (fileName.endsWith(".pdf")) {
      // 处理 PDF 文件 - 使用动态导入解决 CommonJS 兼容性问题
      const pdfParseModule = await import("pdf-parse");
      // @ts-expect-error - pdf-parse has CommonJS/ESM compatibility issues
      const pdfParse = pdfParseModule.default?.default || pdfParseModule.default || pdfParseModule;
      const data = await pdfParse(buffer);
      content = data.text;
    } else if (fileName.endsWith(".docx")) {
      // 处理 DOCX 文件
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } else {
      return {
        success: false,
        error: "不支持的文件格式，请上传 .txt、.pdf 或 .docx 文件",
      };
    }

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        error: "文件内容为空",
      };
    }

    return {
      success: true,
      content: content.trim(),
    };
  } catch (error) {
    console.error("文件解析失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "文件解析失败",
    };
  }
}

/**
 * 使用AI将小说内容拆分成微短剧剧集（异步任务版本）
 */
export async function splitNovelByAIAsync(
  content: string,
  projectId: string,
  options: NovelImportOptions = {}
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    const input: NovelSplitInput = {
      content,
      maxEpisodes: options.maxEpisodes || 20,
    };

    const result = await createJob({
      userId: session.user.id,
      projectId,
      type: "novel_split",
      inputData: input,
      totalSteps: 1,
    });

    return {
      success: result.success,
      jobId: result.jobId,
      error: result.error,
    };
  } catch (error) {
    console.error("提交小说拆分任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "提交任务失败",
    };
  }
}

/**
 * 使用AI将小说内容拆分成微短剧剧集（同步版本，保持向后兼容）
 */
export async function splitNovelByAI(
  content: string,
  options: NovelImportOptions = {}
): Promise<{ success: boolean; data?: NovelSplitResult; error?: string }> {
  try {
    const { maxEpisodes = 20 } = options;

    // 构建专业的微短剧拆分Prompt
    const systemPrompt = `你是一位金牌短剧编剧，深谙当下爆款微短剧（Short Drama）的创作逻辑。
    
# 你的目标
将提供的小说内容改编成高质量微短剧剧本。

# 核心创作原则
1. **高信息密度（High Information Density）**：严禁注水！每一集必须有实质性的剧情大幅推进，不要把一场对话拉长成一集。每集至少包含3-4个明确的情节拍或反转。
2. **黄金3秒法则**：每集前3秒必须有强烈的视觉奇观、状态反差或悬念，瞬间抓住用户注意力。
3. **情绪过山车**：每集都要有情绪的高低起伏，结尾必须是“钩子”（Hook），让人欲罢不能。

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

    // 解析JSON响应
    const result = JSON.parse(response) as NovelSplitResult;

    // 验证结果格式
    if (!result.episodes || !Array.isArray(result.episodes)) {
      throw new Error("AI返回的数据格式不正确");
    }

    // 确保每集都有必要的字段
    const validatedEpisodes = result.episodes.map((ep, index) => ({
      order: ep.order || index + 1,
      title: ep.title || `第${index + 1}集`,
      summary: ep.summary || "",
      hook: ep.hook || "",
      scriptContent: ep.scriptContent || "",
    }));

    return {
      success: true,
      data: {
        episodes: validatedEpisodes,
      },
    };
  } catch (error) {
    console.error("AI拆分失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "AI拆分失败",
    };
  }
}

/**
 * 将拆分好的剧集批量导入到项目中
 */
export async function importNovelToProject(
  projectId: string,
  episodes: NovelEpisodeData[]
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证项目存在且属于当前用户
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id)
      ),
    });

    if (!projectData) {
      throw new Error("项目不存在或无权限");
    }

    // 获取当前项目的最大order值
    const existingEpisodes = await db.query.episode.findMany({
      where: eq(episode.projectId, projectId),
      orderBy: [desc(episode.order)],
    });

    const maxOrder = existingEpisodes.length > 0 ? existingEpisodes[0].order : 0;

    // 批量创建剧集
    const newEpisodes = episodes.map((ep, index) => ({
      id: randomUUID(),
      projectId,
      title: ep.title,
      summary: ep.summary || null,
      hook: ep.hook || null,
      scriptContent: ep.scriptContent || null,
      order: maxOrder + index + 1,
    }));

    await db.insert(episode).values(newEpisodes);

    revalidatePath(`/projects/${projectId}/scripts`);
    
    return { success: true };
  } catch (error) {
    console.error("导入剧集失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "导入失败",
    };
  }
}

/**
 * 优化或生成剧集梗概
 */
export async function optimizeEpisodeSummary(
  title: string,
  hook: string = "",
  scriptContent: string = ""
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    // 构建 Prompt
    const systemPrompt = `你是一位资深微短剧编剧，擅长提炼核心剧情和制造悬念。
    
# 你的任务
根据提供的剧集信息（标题、钩子、剧本内容），生成或优化一段【50字以内】的剧情梗概。

# 要求
1. **精炼**：严格控制在50字以内。
2. **核心事件**：概括本集发生的最主要事件。
3. **悬念感**：语言要有张力，体现微短剧的快节奏和反转。
4. **输出**：直接返回梗概内容，不要包含任何解释性文字或引号。`;

    const userPrompt = `剧集信息如下：
- 标题：${title}
${hook ? `- 钩子/亮点：${hook}` : ''}
${scriptContent ? `- 剧本内容：${scriptContent}` : ''}

请生成该集的剧情梗概：`;

    // 调用 OpenAI API
    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 200, // 限制 token 数，确保简短
        jsonMode: false,
      }
    );

    const summary = response.trim();

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error("生成梗概失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成梗概失败",
    };
  }
}

/**
 * 优化或生成剧集钩子/亮点
 */
export async function optimizeEpisodeHook(
  title: string,
  summary: string = "",
  scriptContent: string = ""
): Promise<{ success: boolean; hook?: string; error?: string }> {
  try {
    const systemPrompt = `你是一位短剧策划专家，非常擅长设计剧情钩子（Hook）和爽点。
    
# 你的任务
根据提供的剧集信息，设计或优化一个强有力的【钩子/亮点】。

# 要求
1. **吸引力**：必须足够抓人眼球，让人产生强烈的观看欲望。
2. **类型**：可以是剧情反转、情感爆发、悬念留白或视觉奇观。
3. **简练**：一句话概括，直击要害。
4. **输出**：直接返回内容，不要包含解释。`;

    const userPrompt = `剧集信息如下：
- 标题：${title}
${summary ? `- 梗概：${summary}` : ''}
${scriptContent ? `- 剧本内容：${scriptContent}` : ''}

请生成本集的钩子/亮点：`;

    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.8,
        maxTokens: 100,
        jsonMode: false,
      }
    );

    return {
      success: true,
      hook: response.trim(),
    };
  } catch (error) {
    console.error("生成钩子失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成钩子失败",
    };
  }
}

/**
 * 优化或生成剧本内容
 */
export async function optimizeEpisodeScript(
  title: string,
  summary: string = "",
  hook: string = "",
  currentScript: string = ""
): Promise<{ success: boolean; script?: string; error?: string }> {
  try {
    const systemPrompt = `你是一位专业微短剧编剧，擅长创作快节奏、强冲突的剧本。

# 你的任务
根据提供的剧集信息，创作或润色本集的完整剧本。

# 创作要求
1. **格式**：标准的剧本格式（场景+人物+对话+动作）。
2. **节奏**：极快，避免废话，三句话一个小冲突，五句话一个大反转。
3. **时长**：控制在1-2分钟的阅读量。
4. **结尾**：必须呼应钩子，留下悬念。
5. **输出**：直接返回剧本内容。`;

    const userPrompt = `剧集信息如下：
- 标题：${title}
${summary ? `- 梗概：${summary}` : ''}
${hook ? `- 钩子/亮点：${hook}` : ''}
${currentScript ? `- 原有剧本（请在此基础上优化）：\n${currentScript}` : ''}

请生成/优化完整剧本：`;

    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 2000,
        jsonMode: false,
      }
    );

    return {
      success: true,
      script: response.trim(),
    };
  } catch (error) {
    console.error("生成剧本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成剧本失败",
    };
  }
}
