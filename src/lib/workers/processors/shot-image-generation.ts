"use server";

import db from "@/lib/db";
import { shot, sceneImage } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { editImage } from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import { updateJobProgress, completeJob, createJob } from "@/lib/actions/job";
import { buildShotImagePrompt } from "@/lib/prompts/shot";
import type {
  Job,
  ShotImageGenerationInput,
  ShotImageGenerationResult,
  BatchShotImageGenerationInput,
  BatchShotImageGenerationResult,
  SceneImageGenerationInput,
  CharacterImageGenerationInput,
} from "@/types/job";
import { verifyProjectOwnership } from "../utils/validation";

/**
 * 处理单个分镜图片生成任务
 */
export async function processShotImageGeneration(
  jobData: Job,
  workerToken: string
): Promise<void> {
  const input: ShotImageGenerationInput = JSON.parse(
    jobData.inputData || "{}"
  );
  const { shotId, regenerate = false } = input;

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
      progressMessage: "正在读取分镜信息...",
    },
    workerToken
  );

  // 获取分镜完整信息
  const shotData = await db.query.shot.findFirst({
    where: eq(shot.id, shotId),
    with: {
      scene: {
        with: {
          images: true,
          project: {
            with: {
              artStyle: true,
            },
          },
        },
      },
      shotCharacters: {
        with: {
          character: true,
          characterImage: true,
        },
      },
    },
  });

  if (!shotData) {
    throw new Error("分镜不存在");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shotScene = shotData.scene as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shotChars = shotData.shotCharacters as any[];

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 15,
      progressMessage: "正在检查依赖资源...",
    },
    workerToken
  );

  // 检查依赖资源并创建缺失的生成任务
  const dependencyJobIds: string[] = [];
  let needWaitForDependencies = false;

  // 1. 检查场景图（需要叙事视角图）
  let sceneQuarterViewImage = null;
  if (shotData.sceneId && shotScene) {
    sceneQuarterViewImage = shotScene.images?.find(
      (img: { imageType: string }) => img.imageType === "quarter_view"
    );

    // 如果场景图不存在或没有 imageUrl，需要生成
    if (!sceneQuarterViewImage?.imageUrl) {
      // 查找或创建场景视角记录
      let sceneImageRecord = sceneQuarterViewImage;
      if (!sceneImageRecord) {
        // 创建场景视角记录
        const newImageId = `sci_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await db.insert(sceneImage).values({
          id: newImageId,
          sceneId: shotData.sceneId,
          imageType: "quarter_view",
          imagePrompt: null,
          imageUrl: null,
        });
        sceneImageRecord = { id: newImageId, imageType: "quarter_view" };
      }

      // 创建场景图生成任务
      const sceneJobInput: SceneImageGenerationInput = {
        sceneId: shotData.sceneId,
        imageId: sceneImageRecord.id,
        regenerate: false,
      };

      const sceneJobResult = await createJob({
        userId: jobData.userId,
        projectId: jobData.projectId || undefined,
        type: "scene_image_generation",
        inputData: sceneJobInput,
        parentJobId: jobData.id,
      });

      if (sceneJobResult.success && sceneJobResult.jobId) {
        dependencyJobIds.push(sceneJobResult.jobId);
        needWaitForDependencies = true;
      }
    }
  }

  // 2. 检查角色造型图
  const characterImageUrls: string[] = [];
  for (const shotChar of shotChars) {
    if (shotChar.characterImageId && shotChar.characterImage) {
      if (!shotChar.characterImage.imageUrl) {
        // 角色造型图不存在，需要生成
        const charJobInput: CharacterImageGenerationInput = {
          characterId: shotChar.characterId,
          imageId: shotChar.characterImageId,
          regenerate: false,
        };

        const charJobResult = await createJob({
          userId: jobData.userId,
          projectId: jobData.projectId || undefined,
          type: "character_image_generation",
          inputData: charJobInput,
          parentJobId: jobData.id,
        });

        if (charJobResult.success && charJobResult.jobId) {
          dependencyJobIds.push(charJobResult.jobId);
          needWaitForDependencies = true;
        }
      } else {
        characterImageUrls.push(shotChar.characterImage.imageUrl);
      }
    }
  }

  // 如果有依赖任务需要等待，先返回部分结果
  if (needWaitForDependencies) {
    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 30,
        progressMessage: `正在生成依赖资源（${dependencyJobIds.length}个）...`,
      },
      workerToken
    );

    // 完成当前任务，标记依赖任务
    const resultData: ShotImageGenerationResult = {
      shotId,
      imageUrl: "", // 暂时为空
      dependencyJobIds,
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData,
      },
      workerToken
    );

    // TODO: 实现依赖任务完成后自动重新触发当前任务的机制
    // 目前先由前端监听子任务完成后手动重试
    return;
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 40,
      progressMessage: "正在构建图片生成 Prompt...",
    },
    workerToken
  );

  // 构建 Prompt
  const characters = shotChars.map((sc) => ({
    name: sc.character.name,
    appearance: sc.character.appearance || undefined,
    action: sc.action || undefined,
    position: sc.position || undefined,
  }));

  const basePrompt = buildShotImagePrompt({
    shotSize: shotData.shotSize,
    cameraMovement: shotData.cameraMovement || "static",
    visualDescription: shotData.visualDescription || "",
    sceneName: shotScene?.name,
    sceneDescription: shotScene?.description,
    characters,
  });

  // 添加全局美术风格
  // 优先使用项目关联的美术风格，fallback到自定义风格提示词
  const globalStylePrompt =
    shotScene?.project?.artStyle?.prompt || shotScene?.project?.stylePrompt || "";

  // 将画风提示词放在prompt的前面，确保画风能够主导整体风格
  const fullPrompt = globalStylePrompt
    ? `${globalStylePrompt}. ${basePrompt}`
    : basePrompt;

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 50,
      progressMessage: regenerate ? "正在重新生成图片..." : "正在生成图片...",
    },
    workerToken
  );

  // 准备参考图片列表
  const referenceImages: string[] = [];
  
  // 添加场景图作为参考
  if (sceneQuarterViewImage?.imageUrl) {
    referenceImages.push(sceneQuarterViewImage.imageUrl);
  }
  
  // 添加角色造型图作为参考
  referenceImages.push(...characterImageUrls);

  // 调用图片生成 API
  let result;
  
  if (referenceImages.length > 0) {
    // 有参考图，使用 image-to-image 模式
    result = await editImage({
      prompt: fullPrompt,
      image_urls: referenceImages,
      num_images: 1,
      aspect_ratio: "16:9",
      output_format: "png",
    });
  } else {
    // 没有参考图，使用纯文生图（fallback）
    const { generateImage } = await import("@/lib/services/fal.service");
    result = await generateImage({
      prompt: fullPrompt,
      num_images: 1,
      aspect_ratio: "16:9",
      output_format: "png",
    });
  }

  if (!result.images || result.images.length === 0) {
    throw new Error("生成失败，没有返回图片");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 75,
      progressMessage: "正在上传图片...",
    },
    workerToken
  );

  // 获取生成的图片
  const generatedImage = result.images[0];
  const imageUrl = generatedImage.url;

  // 上传到 R2
  let finalImageUrl = imageUrl;
  try {
    const uploadResult = await uploadImageFromUrl(
      imageUrl,
      undefined,
      jobData.userId
    );
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

  // 更新分镜的 imageUrl
  await db
    .update(shot)
    .set({
      imageUrl: finalImageUrl,
      updatedAt: new Date(),
    })
    .where(eq(shot.id, shotId));

  // 🆕 使缓存失效
  const { revalidateEpisodeShots } = await import("../utils/revalidate-client");
  const shotForRevalidate = await db.query.shot.findFirst({
    where: eq(shot.id, shotId),
    columns: { episodeId: true },
  });
  
  if (shotForRevalidate?.episodeId) {
    await revalidateEpisodeShots(shotForRevalidate.episodeId);
  }

  const resultData: ShotImageGenerationResult = {
    shotId,
    imageUrl: finalImageUrl,
    dependencyJobIds: dependencyJobIds.length > 0 ? dependencyJobIds : undefined,
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
 * 处理批量分镜图片生成任务
 */
export async function processBatchShotImageGeneration(
  jobData: Job,
  workerToken: string
): Promise<void> {
  const input: BatchShotImageGenerationInput = JSON.parse(
    jobData.inputData || "{}"
  );
  const { shotIds } = input;

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

  if (!shotIds || shotIds.length === 0) {
    throw new Error("未指定要生成的分镜");
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: `正在创建 ${shotIds.length} 个生成任务...`,
    },
    workerToken
  );

  // 为每个分镜创建独立的生成任务
  const childJobIds: string[] = [];

  for (let i = 0; i < shotIds.length; i++) {
    const shotId = shotIds[i];
    const shotJobInput: ShotImageGenerationInput = {
      shotId,
      regenerate: false,
    };

    const shotJobResult = await createJob({
      userId: jobData.userId,
      projectId: jobData.projectId || undefined,
      type: "shot_image_generation",
      inputData: shotJobInput,
      parentJobId: jobData.id,
    });

    if (shotJobResult.success && shotJobResult.jobId) {
      childJobIds.push(shotJobResult.jobId);
    }

    // 更新进度
    const progress = 10 + Math.floor((i + 1) / shotIds.length * 80);
    await updateJobProgress(
      {
        jobId: jobData.id,
        progress,
        progressMessage: `已创建 ${i + 1}/${shotIds.length} 个生成任务`,
      },
      workerToken
    );
  }

  const resultData: BatchShotImageGenerationResult = {
    childJobIds,
    totalShots: shotIds.length,
  };

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}

