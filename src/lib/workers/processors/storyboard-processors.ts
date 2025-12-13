"use server";

import db from "@/lib/db";
import { episode, scene, character, job as jobSchema } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { getChatCompletion } from "@/lib/services/openai.service";
import { updateJobProgress, completeJob, createJob } from "@/lib/actions/job";
import type {
  Job,
  StoryboardGenerationInput,
  StoryboardGenerationResult,
  StoryboardBasicExtractionInput,
  StoryboardBasicExtractionResult,
  StoryboardMatchingInput,
  StoryboardMatchingResult,
} from "@/types/job";
import { verifyProjectOwnership } from "../utils/validation";
import { safeJsonParse } from "../utils/json-parser";
import { createChildJob } from "../utils/job-helpers";

// AI响应的原始类型定义
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
export async function processStoryboardMatching(jobData: Job, workerToken: string): Promise<void> {
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

