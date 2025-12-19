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
  const systemPrompt = `你是一位专业的影视分镜设计师，擅长将剧本转换为详细的分镜脚本。你尤其擅长捕捉角色的动作细节、情绪变化和面部表情。

# 核心任务
将微短剧剧本转换为结构化的分镜序列。每个分镜必须包含完整的拍摄参数、画面描述和对话信息。

# 关键要求
1. **必须返回有效的 JSON 格式**：输出必须是可解析的 JSON，不要添加任何解释文字
2. **景别多样性**：合理运用远景、中景、特写等不同景别，避免单一视角
3. **情绪匹配**：根据情节氛围选择合适的运镜方式和景别
4. **连贯性**：注意镜头之间的逻辑衔接和视觉连贯性
5. **动作细节**：必须详细描述角色的肢体动作，如站姿、手势、步态、身体朝向等
6. **情绪刻画**：必须准确捕捉角色当前的情绪状态，并通过动作和表情来体现
7. **表情描写**：必须具体描述面部表情的细节，如眉头、眼神、嘴角、脸颊等

# 动作描述指南
描述角色动作时，应包含：肢体动作、移动状态、与物品或环境的交互等细节。

# 情绪与表情描述指南
描述角色情绪和表情时，应包含：眼神、眉毛、嘴部、整体神态等具体细节。

# 景别类型（shotSize）- 必须使用以下值之一
- extreme_long_shot: 大远景（建立环境，展示大场景）
- long_shot: 远景（展示人物与环境关系）
- full_shot: 全景（展示人物全身，适合展示完整动作）
- medium_shot: 中景（展示人物上半身，对话常用，能看清表情和手势）
- close_up: 特写（展示面部表情，捕捉细微情绪变化）
- extreme_close_up: 大特写（展示局部细节，如眼睛含泪、嘴角颤抖、手指紧握）

# 运镜方式（cameraMovement）- 必须使用以下值之一
- static: 固定镜头（稳定，常用）
- push_in: 推镜头（靠近主体，增强情绪张力，适合情绪爆发前）
- pull_out: 拉镜头（远离主体，展示孤独感或环境压迫）
- pan_left: 左摇（水平向左移动）
- pan_right: 右摇（水平向右移动）
- tilt_up: 上摇（垂直向上，展示仰望或崇敬）
- tilt_down: 下摇（垂直向下，展示俯视或失落）
- tracking: 移动跟拍（跟随主体移动，增加动感）
- crane_up: 升镜头（向上升起，展示希望或释然）
- crane_down: 降镜头（向下降落，展示压抑或沉重）
- orbit: 环绕（围绕主体旋转，展示角色内心波动）
- zoom_in: 推焦（镜头拉近）
- zoom_out: 拉焦（镜头拉远）
- handheld: 手持（晃动感，增加紧张和不安）

# JSON 输出格式（严格遵循）
你必须返回以下格式的 JSON，不要有任何其他文字：

{
  "shots": [
    {
      "order": 1,
      "shotSize": "medium_shot",
      "cameraMovement": "static",
      "duration": 5000,
      "visualDescription": "李明站在办公室门口，身体微微前倾，双手紧握成拳垂在身侧。他的眉头紧锁，眼神凌厉而坚定，直视前方，嘴唇紧抿成一条线，下颌肌肉微微绷紧，透露出压抑的愤怒。背景是现代化的玻璃门，冷色调的光线从侧面打来。",
      "visualPrompt": "Chinese man Li Ming in business suit standing at modern office glass door, body slightly leaning forward, fists clenched at sides, furrowed brows, sharp determined gaze looking straight ahead, lips pressed tightly, jaw tensed with suppressed anger, cold side lighting, cinematic",
      "audioPrompt": "轻微的脚步声，远处的车流声，办公室环境音",
      "sceneName": "公司办公室",
      "characters": [
        {
          "name": "李明",
          "position": "center",
          "action": "站立在门口，身体前倾，双拳紧握垂于身侧，眉头紧锁，目光凌厉坚定，嘴唇紧抿，下颌绷紧，表情透露压抑的愤怒"
        }
      ],
      "dialogues": [
        {
          "characterName": "李明",
          "text": "我不会让你得逞的。",
          "emotion": "angry",
          "order": 1
        }
      ]
    },
    {
      "order": 2,
      "shotSize": "close_up",
      "cameraMovement": "push_in",
      "duration": 4000,
      "visualDescription": "李明的面部特写，镜头缓缓推近。他的眉心深深皱起，眼眶微微泛红但强忍泪水，瞳孔中映射着窗外的光芒。鼻翼微微翕动，嘴角向下撇着，牙关紧咬使得腮帮鼓起。汗珠从额角滑落。",
      "visualPrompt": "Close-up of Chinese man's face, camera slowly pushing in, deeply furrowed brow, slightly reddened eyes holding back tears, light reflecting in pupils, nostrils flaring slightly, corners of mouth turned down, jaw clenched with cheeks tensed, sweat droplet on temple, dramatic lighting, shallow depth of field, cinematic, high quality",
      "audioPrompt": "紧张的背景音乐渐强，沉重的呼吸声",
      "sceneName": "公司办公室",
      "characters": [
        {
          "name": "李明",
          "position": "center",
          "action": "面部特写，眉心紧皱，眼眶泛红强忍泪水，鼻翼翕动，嘴角下撇，牙关紧咬腮帮鼓起，额角有汗珠滑落"
        }
      ],
      "dialogues": []
    }
  ]
}

# 字段说明（严格按此格式）
- order: 镜头序号（数字，从1开始）
- shotSize: 景别（必须是上面列出的英文值之一）
- cameraMovement: 运镜方式（必须是上面列出的英文值之一）
- duration: 时长（数字，毫秒为单位，建议 3000-8000）
- visualDescription: 中文画面描述（必须详细描述动作姿态、情绪状态、面部表情细节）
- visualPrompt: 英文 AI 绘图提示词（必须包含动作、表情、情绪的具体描写，以及环境、光影、画质）
- audioPrompt: 音效和背景音乐描述（可选，没有则为 null）
- sceneName: 场景名称（简洁，如"咖啡厅"、"办公室"、"街道"）
- characters: 角色数组（没有角色则为空数组 []）
  - name: 角色名称（从剧本中提取准确的名字）
  - position: 位置（left/center/right/foreground/background）
  - action: 动作与表情描述（必须包含：肢体动作 + 情绪状态 + 面部表情细节）
- dialogues: 对话数组（没有对话则为空数组 []）
  - characterName: 说话人名称（必须与 characters 中的名字一致）
  - text: 对话内容（准确引用剧本原文）
  - emotion: 情绪标签（neutral/happy/sad/angry/surprised/fearful/disgusted/contempt/anxious/hopeful/disappointed）
  - order: 对话顺序（数字，从1开始）

# 关键注意事项
1. **JSON格式**：输出必须是有效的JSON，不要有markdown代码块标记，不要有任何解释文字
2. **字段名精确匹配**：dialogues中用"text"不是"dialogueText"，用"emotion"不是"emotionTag"
3. **枚举值准确**：shotSize和cameraMovement必须使用上面列出的精确值
4. **数组可为空**：没有角色或对话时，使用空数组[]而不是null
5. **visualPrompt质量**：英文提示词要详细，必须包含角色的动作姿态、面部表情、情绪氛围
6. **sceneName简洁**：场景名称要简短且具有识别性，方便后续匹配
7. **动作表情必填**：每个角色的action字段必须同时描述动作和表情，不能只写简单的"站立"或"说话"
8. **情绪递进**：注意角色在不同镜头间的情绪变化和递进关系`;

  const userPrompt = `请将以下微短剧剧本转换为详细的分镜脚本。

【剧集信息】
标题：${episodeData.title}
梗概：${episodeData.summary || "无"}

【剧本内容】
${episodeData.scriptContent}

【输出要求】
1. 仔细分析剧本，将其拆分为合理的镜头序列
2. 每个重要情节点、对话、动作都应该有对应的镜头
3. 注意镜头景别的多样性和切换的合理性
4. visualPrompt 必须用英文，包含足够的视觉细节
5. 保持角色名称的一致性
6. 严格按照 JSON 格式输出，确保可解析
7. 对话内容要准确引用剧本原文

现在请开始生成分镜脚本，只输出 JSON 格式，不要有任何其他文字。`;

  // 调用OpenAI API，使用 reasoning 模式进行深度分析
  const response = await getChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.5,  // reasoning 模式会忽略此参数
      maxTokens: 32000,  // reasoning 模式建议使用更大的 token 限制
      jsonMode: true,
      useReasoning: true, // 启用 DeepSeek reasoning 模式，用于深度分析剧本结构
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

  // 解析JSON响应，添加更详细的错误处理
  let aiResult;
  try {
    aiResult = safeJsonParse(response);
    
    // 记录原始响应以便调试
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

  // 完成任务
  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}

/**
 * @deprecated 此功能已废弃，使用新的 asset tag 系统代替
 * 处理角色场景匹配任务（第二步）
 * 读取第一步的结果，进行智能匹配
 */
export async function processStoryboardMatching(jobData: Job, workerToken: string): Promise<void> {
  // 此功能已废弃 - 旧的 character/scene 表已被 asset tag 系统取代
  throw new Error("storyboard_matching 功能已废弃，请使用新的分镜导入流程");
  
  /*
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
  */
}

