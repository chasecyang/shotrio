"use server";

import db from "@/lib/db";
import { characterImage } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { generateImagePro } from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import { buildCharacterSheetPrompt } from "@/lib/prompts/character";
import { generateStylePromptFromDescription } from "@/lib/actions/character/prompt-generation";
import type {
  Job,
  CharacterImageGenerationInput,
  CharacterImageGenerationResult,
} from "@/types/job";
import { verifyProjectOwnership } from "../utils/validation";

/**
 * 处理角色造型生成任务
 * 为已有的造型（characterImage）生成图片
 */
export async function processCharacterImageGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: CharacterImageGenerationInput = JSON.parse(
    jobData.inputData || "{}"
  );
  const { characterId, imageId, regenerate = false } = input;

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
      progress: 10,
      progressMessage: "正在读取造型信息...",
    },
    workerToken
  );

  // 获取造型信息（包含角色信息）
  const imageRecord = await db.query.characterImage.findFirst({
    where: eq(characterImage.id, imageId),
    with: {
      character: {
        with: {
          project: {
            with: {
              artStyle: true, // 关联查询项目的美术风格
            },
          },
        },
      },
    },
  });

  if (!imageRecord) {
    throw new Error("造型不存在");
  }

  if (!imageRecord.character) {
    throw new Error("角色信息不存在");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const character = imageRecord.character as any;

  if (character.id !== characterId) {
    throw new Error("造型与角色不匹配");
  }

  // 验证角色是否属于该项目
  if (jobData.projectId && character.projectId !== jobData.projectId) {
    throw new Error("角色不属于该项目");
  }

  // 如果没有造型描述，自动生成
  let finalImagePrompt = imageRecord.imagePrompt;
  if (!finalImagePrompt) {
    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 15,
        progressMessage: "造型描述为空，正在自动生成...",
      },
      workerToken
    );

    console.log(`造型 ${imageId} 没有描述，开始自动生成...`);
    
    // 使用造型名称作为简单描述来生成专业prompt
    const description = imageRecord.label || "default style";
    const generateResult = await generateStylePromptFromDescription(
      characterId,
      description
    );

    if (!generateResult.success || !generateResult.prompt) {
      throw new Error(
        `自动生成造型描述失败: ${generateResult.error || "未知错误"}`
      );
    }

    finalImagePrompt = generateResult.prompt;

    // 保存生成的描述到数据库
    await db
      .update(characterImage)
      .set({ imagePrompt: finalImagePrompt })
      .where(eq(characterImage.id, imageId));

    console.log(`造型描述已自动生成并保存: ${finalImagePrompt.substring(0, 100)}...`);
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 20,
      progressMessage: regenerate ? "正在重新生成图片..." : "正在生成图片...",
    },
    workerToken
  );

  // 构建完整 Prompt - 使用专业的角色设定图 Prompt
  const baseAppearance = character.appearance || "";
  const stylePrompt = finalImagePrompt; // 使用自动生成的或原有的描述
  
  const fullPrompt = buildCharacterSheetPrompt({
    characterName: character.name,
    baseAppearance: baseAppearance,
    styleDescription: stylePrompt,
  });

  // 获取全局美术风格prompt（优先使用styleId关联的风格，fallback到stylePrompt）
  const globalStylePrompt = character.project?.artStyle?.prompt 
    || character.project?.stylePrompt 
    || "";
  
  // 将画风提示词放在prompt的前面，确保画风能够主导整体风格
  const finalPromptWithStyle = globalStylePrompt 
    ? `${globalStylePrompt}. ${fullPrompt}` 
    : fullPrompt;

  // 调用 fal.ai 生成图像 - 使用横版比例适配设定图布局
  const result = await generateImagePro({
    prompt: finalPromptWithStyle,
    num_images: 1,
    aspect_ratio: "16:9", // 横版设定图，适合展示三视图和多元素
    resolution: "2K",
    output_format: "png",
  });

  if (!result.images || result.images.length === 0) {
    throw new Error("生成失败，没有返回图片");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 70,
      progressMessage: "正在上传图片...",
    },
    workerToken
  );

  // 获取生成的图片
  const generatedImage = result.images[0];
  const imageUrl = generatedImage.url;
  // seed 可能不存在，设为 null
  const seed = null;

  // 上传到 R2（可选，如果需要持久化存储）
  let finalImageUrl = imageUrl;
  try {
    const uploadResult = await uploadImageFromUrl(imageUrl, undefined, jobData.userId);
    if (uploadResult.success && uploadResult.url) {
      finalImageUrl = uploadResult.url;
    }
  } catch (error) {
    console.error("上传图片到 R2 失败，使用原始 URL:", error);
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 90,
      progressMessage: "正在保存图片...",
    },
    workerToken
  );

  // 更新数据库中的 imageUrl 和 seed
  await db
    .update(characterImage)
    .set({
      imageUrl: finalImageUrl,
      seed,
    })
    .where(eq(characterImage.id, imageId));

  const resultData: CharacterImageGenerationResult = {
    imageId,
    imageUrl: finalImageUrl,
  };

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}

