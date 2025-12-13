"use server";

import db from "@/lib/db";
import { sceneImage } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { generateImagePro, editImagePro } from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import type {
  Job,
  SceneImageGenerationInput,
  SceneImageGenerationResult,
} from "@/types/job";
import { verifyProjectOwnership } from "../utils/validation";

/**
 * 处理场景视角生成任务
 * 为已有的场景视角（sceneImage）生成图片
 */
export async function processSceneImageGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: SceneImageGenerationInput = JSON.parse(
    jobData.inputData || "{}"
  );
  const { sceneId, imageId, regenerate = false } = input;

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
      progressMessage: "正在读取场景信息...",
    },
    workerToken
  );

  // 获取场景视角信息（包含场景信息）
  const imageRecord = await db.query.sceneImage.findFirst({
    where: eq(sceneImage.id, imageId),
    with: {
      scene: {
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
    throw new Error("场景视角不存在");
  }

  if (!imageRecord.scene) {
    throw new Error("场景信息不存在");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scene = imageRecord.scene as any;

  if (scene.id !== sceneId) {
    throw new Error("视角与场景不匹配");
  }

  // 验证场景是否属于该项目
  if (jobData.projectId && scene.projectId !== jobData.projectId) {
    throw new Error("场景不属于该项目");
  }

  if (!imageRecord.imagePrompt) {
    throw new Error("该视角没有生成描述，无法生成图片");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 20,
      progressMessage: regenerate ? "正在重新生成图片..." : "正在生成图片...",
    },
    workerToken
  );

  // 使用已保存的 imagePrompt（在创建任务时已经构建好）
  const basePrompt = imageRecord.imagePrompt;

  // 获取全局美术风格prompt（优先使用styleId关联的风格，fallback到stylePrompt）
  const globalStylePrompt = scene.project?.artStyle?.prompt 
    || scene.project?.stylePrompt 
    || "";
  
  // 将全局风格追加到基础prompt
  const fullPrompt = globalStylePrompt 
    ? `${basePrompt}, ${globalStylePrompt}` 
    : basePrompt;

  // 根据图片类型决定使用文生图还是图生图
  let result;
  
  if (imageRecord.imageType === "quarter_view") {
    // 叙事视角图：需要从全景布局图生成（image-to-image）
    // 查询该场景的全景布局图
    const masterLayoutRecord = await db.query.sceneImage.findFirst({
      where: and(
        eq(sceneImage.sceneId, sceneId),
        eq(sceneImage.imageType, "master_layout")
      ),
    });

    if (!masterLayoutRecord?.imageUrl) {
      throw new Error("生成叙事视角图需要先生成全景布局图");
    }

    // 使用 image-to-image 模式，从全景布局图聚焦到表演区域
    result = await editImagePro({
      prompt: fullPrompt,
      image_urls: [masterLayoutRecord.imageUrl],
      num_images: 1,
      aspect_ratio: "16:9", // 横版场景图
      resolution: "2K",
      output_format: "png",
    });
  } else {
    // 全景布局图：直接文生图
    result = await generateImagePro({
      prompt: fullPrompt,
      num_images: 1,
      aspect_ratio: "16:9", // 横版场景图
      resolution: "2K",
      output_format: "png",
    });
  }

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
  const seed = null;

  // 上传到 R2
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
    .update(sceneImage)
    .set({
      imageUrl: finalImageUrl,
      seed,
    })
    .where(eq(sceneImage.id, imageId));

  const resultData: SceneImageGenerationResult = {
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

