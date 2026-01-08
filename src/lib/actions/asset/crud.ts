"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import {
  asset,
  assetTag,
  imageData,
  videoData,
  textData,
  audioData,
  job,
} from "@/lib/db/schemas/project";
import { eq, inArray, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import type {
  AssetTypeEnum,
  AssetSourceType,
  AssetMeta,
  AssetWithTags,
  AssetWithFullData,
  CreateImageDataInput,
  CreateVideoDataInput,
  CreateTextDataInput,
  CreateAudioDataInput,
  UpdateImageDataInput,
  UpdateVideoDataInput,
  UpdateTextDataInput,
  UpdateAudioDataInput,
} from "@/types/asset";
import { enrichAssetWithFullData } from "@/lib/utils/asset-status";
import { revalidatePath } from "next/cache";

// ===== 创建资产的输入类型（完整版，包含所有扩展数据） =====

interface CreateAssetFullInput {
  projectId: string;
  name: string;
  assetType: AssetTypeEnum;
  sourceType: AssetSourceType;
  meta?: AssetMeta;
  tags?: string[];
  order?: number;

  // 类型数据（根据 assetType 选择，包含生成信息）
  imageData?: Omit<CreateImageDataInput, "assetId">;
  videoData?: Omit<CreateVideoDataInput, "assetId">;
  textData?: Omit<CreateTextDataInput, "assetId">;
  audioData?: Omit<CreateAudioDataInput, "assetId">;
}

// ===== 更新资产的输入类型（完整版） =====

interface UpdateAssetFullInput {
  name?: string;
  meta?: AssetMeta;
  order?: number;

  // 类型数据更新（根据 assetType，包含生成信息）
  imageData?: UpdateImageDataInput;
  videoData?: UpdateVideoDataInput;
  textData?: UpdateTextDataInput;
  audioData?: UpdateAudioDataInput;
}

/**
 * 内部函数：创建新资产（不需要session，由worker调用）
 *
 * 使用版本化结构：
 * - 基表 asset：共享字段
 * - imageData/videoData：包含版本和生成信息（合并了 generationInfo）
 * - textData/audioData：暂不做版本化
 *
 * @returns 返回 imageDataId 或 videoDataId 用于 job 关联
 */
export async function createAssetInternal(
  input: CreateAssetFullInput & { userId: string }
): Promise<{
  success: boolean;
  asset?: AssetWithTags;
  imageDataId?: string;
  videoDataId?: string;
  error?: string;
}> {
  try {
    const assetId = randomUUID();
    let imageDataId: string | undefined;
    let videoDataId: string | undefined;

    // 1. 插入基表 asset
    await db.insert(asset).values({
      id: assetId,
      projectId: input.projectId,
      userId: input.userId,
      name: input.name,
      assetType: input.assetType,
      sourceType: input.sourceType,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      order: input.order ?? null,
      usageCount: 0,
    });

    // 2. 插入类型特定数据（版本化结构，包含生成信息）
    switch (input.assetType) {
      case "image": {
        // 创建 imageData 记录（带版本 ID 和生成信息）
        imageDataId = randomUUID();
        await db.insert(imageData).values({
          id: imageDataId,
          assetId,
          imageUrl: input.imageData?.imageUrl ?? null,
          thumbnailUrl: input.imageData?.thumbnailUrl ?? null,
          prompt: input.imageData?.prompt ?? null,
          seed: input.imageData?.seed ?? null,
          modelUsed: input.imageData?.modelUsed ?? null,
          generationConfig: input.imageData?.generationConfig ?? null,
          sourceAssetIds: input.imageData?.sourceAssetIds ?? null,
          isActive: true,
        });
        break;
      }
      case "video": {
        // 创建 videoData 记录（带版本 ID 和生成信息）
        videoDataId = randomUUID();
        await db.insert(videoData).values({
          id: videoDataId,
          assetId,
          videoUrl: input.videoData?.videoUrl ?? null,
          thumbnailUrl: input.videoData?.thumbnailUrl ?? null,
          duration: input.videoData?.duration ?? null,
          prompt: input.videoData?.prompt ?? null,
          seed: input.videoData?.seed ?? null,
          modelUsed: input.videoData?.modelUsed ?? null,
          generationConfig: input.videoData?.generationConfig ?? null,
          sourceAssetIds: input.videoData?.sourceAssetIds ?? null,
          isActive: true,
        });
        break;
      }
      case "text":
        if (input.textData) {
          await db.insert(textData).values({
            assetId,
            textContent: input.textData.textContent ?? null,
          });
        }
        break;
      case "audio":
        if (input.audioData) {
          await db.insert(audioData).values({
            assetId,
            audioUrl: input.audioData.audioUrl ?? null,
            duration: input.audioData.duration ?? null,
            format: input.audioData.format ?? null,
            sampleRate: input.audioData.sampleRate ?? null,
            bitrate: input.audioData.bitrate ?? null,
            channels: input.audioData.channels ?? null,
            prompt: input.audioData.prompt ?? null,
            seed: input.audioData.seed ?? null,
            modelUsed: input.audioData.modelUsed ?? null,
            generationConfig: input.audioData.generationConfig ?? null,
            sourceAssetIds: input.audioData.sourceAssetIds ?? null,
          });
        }
        break;
    }

    // 4. 插入标签
    if (input.tags && input.tags.length > 0) {
      await db.insert(assetTag).values(
        input.tags.map((tagValue) => ({
          id: randomUUID(),
          assetId,
          tagValue,
        }))
      );
    }

    // 5. 查询创建的资产及其标签
    const createdAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
      with: {
        tags: true,
      },
    });

    if (!createdAsset) {
      return { success: false, error: "创建资产后查询失败" };
    }

    // 在worker环境中，revalidatePath可能会失败，需要安全处理
    try {
      revalidatePath(`/[lang]/projects/${input.projectId}`, "page");
    } catch {
      console.log("无法revalidate路径（worker环境）");
    }

    return {
      success: true,
      asset: createdAsset as AssetWithTags,
      imageDataId,
      videoDataId,
    };
  } catch (error) {
    console.error("创建资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建资产失败",
    };
  }
}

/**
 * 创建新资产（需要session）
 */
export async function createAsset(input: CreateAssetFullInput): Promise<{
  success: boolean;
  asset?: AssetWithTags;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  return createAssetInternal({ ...input, userId: session.user.id });
}

/**
 * 更新资产
 */
export async function updateAsset(
  assetId: string,
  input: UpdateAssetFullInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 1. 更新基表
    const baseUpdateData: Record<string, unknown> = {};
    if (input.name !== undefined) baseUpdateData.name = input.name;
    if (input.meta !== undefined)
      baseUpdateData.meta = JSON.stringify(input.meta);
    if (input.order !== undefined) baseUpdateData.order = input.order;

    if (Object.keys(baseUpdateData).length > 0) {
      await db.update(asset).set(baseUpdateData).where(eq(asset.id, assetId));
    }

    // 2. 更新类型特定数据（更新激活版本，包含生成信息）
    if (input.imageData) {
      const imgUpdateData: Record<string, unknown> = {};
      if (input.imageData.imageUrl !== undefined)
        imgUpdateData.imageUrl = input.imageData.imageUrl;
      if (input.imageData.thumbnailUrl !== undefined)
        imgUpdateData.thumbnailUrl = input.imageData.thumbnailUrl;
      // 支持更新生成信息
      if (input.imageData.prompt !== undefined)
        imgUpdateData.prompt = input.imageData.prompt;
      if (input.imageData.seed !== undefined)
        imgUpdateData.seed = input.imageData.seed;
      if (input.imageData.modelUsed !== undefined)
        imgUpdateData.modelUsed = input.imageData.modelUsed;
      if (input.imageData.generationConfig !== undefined)
        imgUpdateData.generationConfig = input.imageData.generationConfig;
      if (input.imageData.sourceAssetIds !== undefined)
        imgUpdateData.sourceAssetIds = input.imageData.sourceAssetIds;

      if (Object.keys(imgUpdateData).length > 0) {
        // 更新激活版本
        await db
          .update(imageData)
          .set(imgUpdateData)
          .where(and(eq(imageData.assetId, assetId), eq(imageData.isActive, true)));
      }
    }

    if (input.videoData) {
      const vidUpdateData: Record<string, unknown> = {};
      if (input.videoData.videoUrl !== undefined)
        vidUpdateData.videoUrl = input.videoData.videoUrl;
      if (input.videoData.thumbnailUrl !== undefined)
        vidUpdateData.thumbnailUrl = input.videoData.thumbnailUrl;
      if (input.videoData.duration !== undefined)
        vidUpdateData.duration = input.videoData.duration;
      // 支持更新生成信息
      if (input.videoData.prompt !== undefined)
        vidUpdateData.prompt = input.videoData.prompt;
      if (input.videoData.seed !== undefined)
        vidUpdateData.seed = input.videoData.seed;
      if (input.videoData.modelUsed !== undefined)
        vidUpdateData.modelUsed = input.videoData.modelUsed;
      if (input.videoData.generationConfig !== undefined)
        vidUpdateData.generationConfig = input.videoData.generationConfig;
      if (input.videoData.sourceAssetIds !== undefined)
        vidUpdateData.sourceAssetIds = input.videoData.sourceAssetIds;

      if (Object.keys(vidUpdateData).length > 0) {
        // 更新激活版本
        await db
          .update(videoData)
          .set(vidUpdateData)
          .where(and(eq(videoData.assetId, assetId), eq(videoData.isActive, true)));
      }
    }

    if (input.textData) {
      const txtUpdateData: Record<string, unknown> = {};
      if (input.textData.textContent !== undefined)
        txtUpdateData.textContent = input.textData.textContent;

      if (Object.keys(txtUpdateData).length > 0) {
        await db
          .update(textData)
          .set(txtUpdateData)
          .where(eq(textData.assetId, assetId));
      }
    }

    if (input.audioData) {
      const audUpdateData: Record<string, unknown> = {};
      if (input.audioData.audioUrl !== undefined)
        audUpdateData.audioUrl = input.audioData.audioUrl;
      if (input.audioData.duration !== undefined)
        audUpdateData.duration = input.audioData.duration;
      if (input.audioData.format !== undefined)
        audUpdateData.format = input.audioData.format;
      if (input.audioData.sampleRate !== undefined)
        audUpdateData.sampleRate = input.audioData.sampleRate;
      if (input.audioData.bitrate !== undefined)
        audUpdateData.bitrate = input.audioData.bitrate;
      if (input.audioData.channels !== undefined)
        audUpdateData.channels = input.audioData.channels;
      // 生成信息
      if (input.audioData.prompt !== undefined)
        audUpdateData.prompt = input.audioData.prompt;
      if (input.audioData.seed !== undefined)
        audUpdateData.seed = input.audioData.seed;
      if (input.audioData.modelUsed !== undefined)
        audUpdateData.modelUsed = input.audioData.modelUsed;
      if (input.audioData.generationConfig !== undefined)
        audUpdateData.generationConfig = input.audioData.generationConfig;
      if (input.audioData.sourceAssetIds !== undefined)
        audUpdateData.sourceAssetIds = input.audioData.sourceAssetIds;

      if (Object.keys(audUpdateData).length > 0) {
        await db
          .update(audioData)
          .set(audUpdateData)
          .where(eq(audioData.assetId, assetId));
      }
    }

    revalidatePath(`/[lang]/projects/${existingAsset.projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("更新资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新资产失败",
    };
  }
}

/**
 * 删除资产
 */
export async function deleteAsset(assetId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 删除资产（扩展表会因为CASCADE自动删除）
    await db.delete(asset).where(eq(asset.id, assetId));

    revalidatePath(`/[lang]/projects/${existingAsset.projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("删除资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除资产失败",
    };
  }
}

/**
 * 批量删除资产
 */
export async function deleteAssets(assetIds: string[]): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  if (!assetIds || assetIds.length === 0) {
    return { success: false, error: "未选择要删除的素材" };
  }

  try {
    // 验证权限：确保所有素材都属于当前用户
    const existingAssets = await db.query.asset.findMany({
      where: inArray(asset.id, assetIds),
    });

    if (existingAssets.length === 0) {
      return { success: false, error: "未找到要删除的素材" };
    }

    // 检查权限
    const unauthorizedAssets = existingAssets.filter(
      (a) => a.userId !== session.user.id
    );
    if (unauthorizedAssets.length > 0) {
      return { success: false, error: "无权限删除部分素材" };
    }

    // 获取项目ID用于revalidate（假设所有素材属于同一项目）
    const projectId = existingAssets[0]?.projectId;

    // 批量删除资产（扩展表会因为CASCADE自动删除）
    await db.delete(asset).where(inArray(asset.id, assetIds));

    // Revalidate路径
    if (projectId) {
      revalidatePath(`/[lang]/projects/${projectId}`, "page");
    }

    return { success: true, deletedCount: existingAssets.length };
  } catch (error) {
    console.error("批量删除资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "批量删除资产失败",
    };
  }
}

/**
 * 获取单个资产详情（带标签，不含运行时状态）
 */
export async function getAsset(assetId: string): Promise<{
  success: boolean;
  asset?: AssetWithTags;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
      with: {
        tags: true,
      },
    });

    if (!assetData) {
      return { success: false, error: "资产不存在" };
    }

    // 验证权限
    if (assetData.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    return {
      success: true,
      asset: assetData as AssetWithTags,
    };
  } catch (error) {
    console.error("获取资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取资产失败",
    };
  }
}

/**
 * 获取单个资产完整数据（带所有关联数据、运行时状态和扁平化属性）
 */
export async function getAssetWithFullData(assetId: string): Promise<{
  success: boolean;
  asset?: AssetWithFullData;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 查询资产及所有关联数据
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
      with: {
        tags: true,
        imageDataList: true,
        videoDataList: true,
        textData: true,
        audioData: true,
      },
    });

    if (!assetData) {
      return { success: false, error: "资产不存在" };
    }

    // 验证权限
    if (assetData.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 查询最新的 job（仅 generated 类型需要）
    let latestJob = null;
    if (assetData.sourceType === "generated") {
      const jobData = await db.query.job.findFirst({
        where: eq(job.assetId, assetId),
        orderBy: (job, { desc }) => [desc(job.createdAt)],
      });
      latestJob = jobData || null;
    }

    // 使用 enrichAssetWithFullData 构建完整数据
    const enrichedAsset = enrichAssetWithFullData(
      assetData as import("@/types/asset").Asset,
      assetData.tags,
      assetData.imageDataList,
      assetData.videoDataList,
      assetData.textData,
      assetData.audioData,
      latestJob as import("@/types/job").Job | null
    );

    return {
      success: true,
      asset: enrichedAsset,
    };
  } catch (error) {
    console.error("获取资产完整数据失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取资产完整数据失败",
    };
  }
}

/**
 * 批量获取资产（用于展示，返回基本信息 + 图片URL）
 */
export async function getAssetsByIds(assetIds: string[]): Promise<{
  success: boolean;
  assets?: Array<{
    id: string;
    name: string;
    assetType: AssetTypeEnum;
    displayUrl: string | null;
  }>;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  if (assetIds.length === 0) {
    return { success: true, assets: [] };
  }

  try {
    // 使用 relations 查询，包含图片数据
    const assetsData = await db.query.asset.findMany({
      where: and(inArray(asset.id, assetIds), eq(asset.userId, session.user.id)),
      with: {
        imageDataList: true,
      },
    });

    // 转换为返回格式，计算 displayUrl
    const assets = assetsData.map((a) => {
      // 找到激活的 imageData 版本
      const activeImageData = a.imageDataList?.find((img: { isActive: boolean }) => img.isActive);
      return {
        id: a.id,
        name: a.name,
        assetType: a.assetType as AssetTypeEnum,
        displayUrl: activeImageData?.thumbnailUrl ?? activeImageData?.imageUrl ?? null,
      };
    });

    return {
      success: true,
      assets,
    };
  } catch (error) {
    console.error("批量获取资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "批量获取资产失败",
    };
  }
}

/**
 * 增加资产使用次数
 */
export async function incrementAssetUsage(assetId: string): Promise<void> {
  try {
    await db
      .update(asset)
      .set({
        usageCount: asset.usageCount + 1,
      })
      .where(eq(asset.id, assetId));
  } catch (error) {
    console.error("更新资产使用次数失败:", error);
  }
}

// ===== 视频资产相关函数 =====

/**
 * 创建视频生成任务
 */
export async function createVideoAsset(data: {
  projectId: string;
  name: string;
  prompt: string;
  referenceAssetIds?: string[];
  generationConfig: import("@/types/asset").VideoGenerationConfig;
  order?: number;
  tags?: string[];
}): Promise<{
  success: boolean;
  data?: { asset: AssetWithTags; jobId: string };
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const assetId = randomUUID();
    const videoDataId = randomUUID();
    const jobId = randomUUID();

    // 1. 创建 asset 基表记录
    await db.insert(asset).values({
      id: assetId,
      projectId: data.projectId,
      userId: session.user.id,
      name: data.name,
      assetType: "video",
      sourceType: "generated",
      order: data.order ?? null,
      usageCount: 0,
    });

    // 2. 创建 videoData 记录（版本化结构，包含生成信息）
    await db.insert(videoData).values({
      id: videoDataId,
      assetId,
      videoUrl: null,
      thumbnailUrl: null,
      duration: null,
      prompt: data.prompt,
      generationConfig: JSON.stringify(data.generationConfig),
      sourceAssetIds: data.referenceAssetIds ?? null,
      isActive: true,
    });

    // 3. 插入标签
    if (data.tags && data.tags.length > 0) {
      await db.insert(assetTag).values(
        data.tags.map((tagValue) => ({
          id: randomUUID(),
          assetId,
          tagValue,
        }))
      );
    }

    // 5. 创建 job 任务（关联到版本）
    await db.insert(job).values({
      id: jobId,
      userId: session.user.id,
      projectId: data.projectId,
      type: "asset_video",
      status: "pending",
      assetId: assetId,
      videoDataId: videoDataId,
      inputData: {},
      progress: 0,
      currentStep: 0,
    });

    // 6. 查询创建的资产及其标签
    const createdAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
      with: {
        tags: true,
      },
    });

    if (!createdAsset) {
      return { success: false, error: "创建资产后查询失败" };
    }

    revalidatePath(`/[lang]/projects/${data.projectId}`, "page");

    return {
      success: true,
      data: {
        asset: createdAsset as AssetWithTags,
        jobId,
      },
    };
  } catch (error) {
    console.error("创建视频资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建视频资产失败",
    };
  }
}

/**
 * 查询视频资产
 */
export async function getVideoAssets(
  projectId: string,
  options?: {
    tags?: string[];
    orderBy?: "created" | "order";
  }
): Promise<{
  success: boolean;
  videos?: AssetWithFullData[];
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const { getProjectAssets } = await import("./queries");

    const videos = await getProjectAssets({
      projectId,
      assetType: "video",
      tagFilters: options?.tags,
      orderBy: options?.orderBy,
    });

    return { success: true, videos };
  } catch (error) {
    console.error("查询视频资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "查询视频资产失败",
    };
  }
}

/**
 * 更新视频资产
 */
export async function updateVideoAsset(
  assetId: string,
  data: {
    name?: string;
    prompt?: string;
    order?: number;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限和类型
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "视频资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    if (existingAsset.assetType !== "video") {
      return { success: false, error: "不是视频资产" };
    }

    // 1. 更新基表
    const baseUpdateData: Record<string, unknown> = {};
    if (data.name !== undefined) baseUpdateData.name = data.name;
    if (data.order !== undefined) baseUpdateData.order = data.order;

    if (Object.keys(baseUpdateData).length > 0) {
      await db.update(asset).set(baseUpdateData).where(eq(asset.id, assetId));
    }

    // 2. 更新 videoData（如果更新 prompt）
    if (data.prompt !== undefined) {
      await db
        .update(videoData)
        .set({ prompt: data.prompt })
        .where(and(eq(videoData.assetId, assetId), eq(videoData.isActive, true)));
    }

    revalidatePath(`/[lang]/projects/${existingAsset.projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("更新视频资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新视频资产失败",
    };
  }
}

/**
 * 删除视频资产
 */
export async function deleteVideoAssets(assetIds: string[]): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  // 直接复用通用的删除函数
  return deleteAssets(assetIds);
}

// ===== 音频资产相关函数 =====

/**
 * 创建音频生成任务
 */
export async function createAudioAsset(data: {
  projectId: string;
  name: string;
  prompt?: string;
  sourceAssetIds?: string[];
  meta?: AssetMeta;
  tags?: string[];
}): Promise<{
  success: boolean;
  data?: { asset: AssetWithTags; jobId: string };
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const assetId = randomUUID();
    const jobId = randomUUID();

    // 1. 创建 asset 基表记录
    await db.insert(asset).values({
      id: assetId,
      projectId: data.projectId,
      userId: session.user.id,
      name: data.name,
      assetType: "audio",
      sourceType: "generated",
      meta: data.meta ? JSON.stringify(data.meta) : null,
      usageCount: 0,
    });

    // 2. 创建 audioData 记录（包含生成信息，初始音频为空，worker 完成后更新）
    await db.insert(audioData).values({
      assetId,
      audioUrl: null,
      duration: null,
      prompt: data.prompt ?? null,
      sourceAssetIds: data.sourceAssetIds ?? null,
    });

    // 3. 插入标签
    if (data.tags && data.tags.length > 0) {
      await db.insert(assetTag).values(
        data.tags.map((tagValue) => ({
          id: randomUUID(),
          assetId,
          tagValue,
        }))
      );
    }

    // 4. 创建 job 任务
    await db.insert(job).values({
      id: jobId,
      userId: session.user.id,
      projectId: data.projectId,
      type: "asset_audio",
      status: "pending",
      assetId: assetId,
      inputData: {},
      progress: 0,
      currentStep: 0,
    });

    // 5. 查询创建的资产及其标签
    const createdAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
      with: {
        tags: true,
      },
    });

    if (!createdAsset) {
      return { success: false, error: "创建资产后查询失败" };
    }

    revalidatePath(`/[lang]/projects/${data.projectId}`, "page");

    return {
      success: true,
      data: {
        asset: createdAsset as AssetWithTags,
        jobId,
      },
    };
  } catch (error) {
    console.error("创建音频资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建音频资产失败",
    };
  }
}

/**
 * 上传音频资产（用户上传，非 AI 生成）
 */
export async function uploadAudioAsset(data: {
  projectId: string;
  name: string;
  audioUrl: string;
  duration?: number;
  format?: string;
  sampleRate?: number;
  bitrate?: number;
  channels?: number;
  meta?: AssetMeta;
  tags?: string[];
}): Promise<{
  success: boolean;
  asset?: AssetWithTags;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  return createAssetInternal({
    projectId: data.projectId,
    userId: session.user.id,
    name: data.name,
    assetType: "audio",
    sourceType: "uploaded",
    meta: data.meta,
    tags: data.tags,
    audioData: {
      audioUrl: data.audioUrl,
      duration: data.duration,
      format: data.format,
      sampleRate: data.sampleRate,
      bitrate: data.bitrate,
      channels: data.channels,
    },
  });
}

// ===== 版本管理函数 =====

/**
 * 创建新版本（用于重新生成功能）
 */
export async function createAssetVersion(
  assetId: string,
  input: Omit<CreateImageDataInput, "assetId"> | Omit<CreateVideoDataInput, "assetId">
): Promise<{
  success: boolean;
  versionId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    const versionId = randomUUID();

    // 根据资产类型创建版本
    if (existingAsset.assetType === "image") {
      const imgInput = input as Omit<CreateImageDataInput, "assetId">;

      // 先将所有版本设为非激活
      await db
        .update(imageData)
        .set({ isActive: false })
        .where(eq(imageData.assetId, assetId));

      // 创建新版本
      await db.insert(imageData).values({
        id: versionId,
        assetId,
        imageUrl: imgInput.imageUrl ?? null,
        thumbnailUrl: imgInput.thumbnailUrl ?? null,
        prompt: imgInput.prompt ?? null,
        seed: imgInput.seed ?? null,
        modelUsed: imgInput.modelUsed ?? null,
        generationConfig: imgInput.generationConfig ?? null,
        sourceAssetIds: imgInput.sourceAssetIds ?? null,
        isActive: true,
      });
    } else if (existingAsset.assetType === "video") {
      const vidInput = input as Omit<CreateVideoDataInput, "assetId">;

      // 先将所有版本设为非激活
      await db
        .update(videoData)
        .set({ isActive: false })
        .where(eq(videoData.assetId, assetId));

      // 创建新版本
      await db.insert(videoData).values({
        id: versionId,
        assetId,
        videoUrl: vidInput.videoUrl ?? null,
        thumbnailUrl: vidInput.thumbnailUrl ?? null,
        duration: vidInput.duration ?? null,
        prompt: vidInput.prompt ?? null,
        seed: vidInput.seed ?? null,
        modelUsed: vidInput.modelUsed ?? null,
        generationConfig: vidInput.generationConfig ?? null,
        sourceAssetIds: vidInput.sourceAssetIds ?? null,
        isActive: true,
      });
    } else {
      return { success: false, error: "该资产类型不支持版本化" };
    }

    try {
      revalidatePath(`/[lang]/projects/${existingAsset.projectId}`, "page");
    } catch {
      console.log("无法revalidate路径");
    }

    return { success: true, versionId };
  } catch (error) {
    console.error("创建版本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建版本失败",
    };
  }
}

/**
 * 设置激活版本
 */
export async function setActiveVersion(
  assetId: string,
  versionId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    if (existingAsset.assetType === "image") {
      // 验证版本存在
      const version = await db.query.imageData.findFirst({
        where: and(eq(imageData.id, versionId), eq(imageData.assetId, assetId)),
      });

      if (!version) {
        return { success: false, error: "版本不存在" };
      }

      // 将所有版本设为非激活
      await db
        .update(imageData)
        .set({ isActive: false })
        .where(eq(imageData.assetId, assetId));

      // 激活指定版本
      await db
        .update(imageData)
        .set({ isActive: true })
        .where(eq(imageData.id, versionId));
    } else if (existingAsset.assetType === "video") {
      // 验证版本存在
      const version = await db.query.videoData.findFirst({
        where: and(eq(videoData.id, versionId), eq(videoData.assetId, assetId)),
      });

      if (!version) {
        return { success: false, error: "版本不存在" };
      }

      // 将所有版本设为非激活
      await db
        .update(videoData)
        .set({ isActive: false })
        .where(eq(videoData.assetId, assetId));

      // 激活指定版本
      await db
        .update(videoData)
        .set({ isActive: true })
        .where(eq(videoData.id, versionId));
    } else {
      return { success: false, error: "该资产类型不支持版本化" };
    }

    try {
      revalidatePath(`/[lang]/projects/${existingAsset.projectId}`, "page");
    } catch {
      console.log("无法revalidate路径");
    }

    return { success: true };
  } catch (error) {
    console.error("设置激活版本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "设置激活版本失败",
    };
  }
}

/**
 * 重新生成视频（创建新版本）
 */
export async function regenerateVideoAsset(
  assetId: string
): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取现有素材
    const assetResult = await getAssetWithFullData(assetId);

    if (!assetResult.success || !assetResult.asset) {
      return { success: false, error: assetResult.error || "素材不存在" };
    }

    const existingAsset = assetResult.asset;

    // 验证是否可以重新生成
    if (existingAsset.sourceType !== "generated") {
      return { success: false, error: "只能重新生成 AI 生成的素材" };
    }

    if (existingAsset.assetType !== "video") {
      return { success: false, error: "此方法仅支持视频素材" };
    }

    if (!existingAsset.prompt && !existingAsset.generationConfig) {
      return { success: false, error: "缺少生成参数" };
    }

    // 创建新版本
    const versionResult = await createAssetVersion(assetId, {
      prompt: existingAsset.prompt ?? undefined,
      modelUsed: existingAsset.modelUsed ?? undefined,
      generationConfig: existingAsset.generationConfig ?? undefined,
      sourceAssetIds: existingAsset.sourceAssetIds || undefined,
    });

    if (!versionResult.success || !versionResult.versionId) {
      return { success: false, error: versionResult.error || "创建版本失败" };
    }

    // 创建视频生成任务（关联到新版本）
    const jobId = randomUUID();
    await db.insert(job).values({
      id: jobId,
      userId: session.user.id,
      projectId: existingAsset.projectId,
      type: "asset_video",
      status: "pending",
      assetId: assetId,
      videoDataId: versionResult.versionId,
      inputData: {},
      progress: 0,
      currentStep: 0,
    });

    return {
      success: true,
      jobId,
    };
  } catch (error) {
    console.error("重新生成视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新生成视频失败",
    };
  }
}

/**
 * 删除版本
 */
export async function deleteAssetVersion(
  versionId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 先尝试在 imageData 中查找
    const imageDataVersion = await db.query.imageData.findFirst({
      where: eq(imageData.id, versionId),
    });

    let assetType: "image" | "video" = "image";
    let version: { id: string; assetId: string; isActive: boolean } | null = null;

    if (imageDataVersion) {
      version = imageDataVersion;
    } else {
      // 在 videoData 中查找
      const videoDataVersion = await db.query.videoData.findFirst({
        where: eq(videoData.id, versionId),
      });
      if (videoDataVersion) {
        version = videoDataVersion;
        assetType = "video";
      }
    }

    if (!version) {
      return { success: false, error: "版本不存在" };
    }

    // 验证权限
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, version.assetId),
    });

    if (!existingAsset || existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 检查是否是激活版本
    if (version.isActive) {
      // 查找其他版本
      const otherVersions = assetType === "image"
        ? await db.query.imageData.findMany({
            where: and(
              eq(imageData.assetId, version.assetId),
              eq(imageData.isActive, false)
            ),
            orderBy: (imageData, { desc }) => [desc(imageData.createdAt)],
            limit: 1,
          })
        : await db.query.videoData.findMany({
            where: and(
              eq(videoData.assetId, version.assetId),
              eq(videoData.isActive, false)
            ),
            orderBy: (videoData, { desc }) => [desc(videoData.createdAt)],
            limit: 1,
          });

      if (otherVersions.length === 0) {
        return { success: false, error: "无法删除唯一版本" };
      }

      // 激活最新的其他版本
      if (assetType === "image") {
        await db
          .update(imageData)
          .set({ isActive: true })
          .where(eq(imageData.id, otherVersions[0].id));
      } else {
        await db
          .update(videoData)
          .set({ isActive: true })
          .where(eq(videoData.id, otherVersions[0].id));
      }
    }

    // 删除版本
    if (assetType === "image") {
      await db.delete(imageData).where(eq(imageData.id, versionId));
    } else {
      await db.delete(videoData).where(eq(videoData.id, versionId));
    }

    try {
      revalidatePath(`/[lang]/projects/${existingAsset.projectId}`, "page");
    } catch {
      console.log("无法revalidate路径");
    }

    return { success: true };
  } catch (error) {
    console.error("删除版本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除版本失败",
    };
  }
}
