"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import {
  asset,
  assetTag,
  generationInfo,
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
  CreateGenerationInfoInput,
  CreateImageDataInput,
  CreateVideoDataInput,
  CreateTextDataInput,
  CreateAudioDataInput,
  UpdateGenerationInfoInput,
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

  // 生成信息（仅 generated 类型需要）
  generationInfo?: Omit<CreateGenerationInfoInput, "assetId">;

  // 类型数据（根据 assetType 选择）
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

  // 生成信息更新
  generationInfo?: UpdateGenerationInfoInput;

  // 类型数据更新（根据 assetType）
  imageData?: UpdateImageDataInput;
  videoData?: UpdateVideoDataInput;
  textData?: UpdateTextDataInput;
  audioData?: UpdateAudioDataInput;
}

/**
 * 内部函数：创建新资产（不需要session，由worker调用）
 *
 * 使用新的多表结构：
 * - 基表 asset：共享字段
 * - generationInfo：AI 生成信息（仅 generated 类型）
 * - imageData/videoData/textData/audioData：类型特定数据
 */
export async function createAssetInternal(
  input: CreateAssetFullInput & { userId: string }
): Promise<{
  success: boolean;
  asset?: AssetWithTags;
  error?: string;
}> {
  try {
    const assetId = randomUUID();

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

    // 2. 插入生成信息（仅 generated 类型）
    if (input.sourceType === "generated" && input.generationInfo) {
      await db.insert(generationInfo).values({
        assetId,
        prompt: input.generationInfo.prompt ?? null,
        seed: input.generationInfo.seed ?? null,
        modelUsed: input.generationInfo.modelUsed ?? null,
        generationConfig: input.generationInfo.generationConfig ?? null,
        sourceAssetIds: input.generationInfo.sourceAssetIds ?? null,
      });
    }

    // 3. 插入类型特定数据
    switch (input.assetType) {
      case "image":
        if (input.imageData) {
          await db.insert(imageData).values({
            assetId,
            imageUrl: input.imageData.imageUrl ?? null,
            thumbnailUrl: input.imageData.thumbnailUrl ?? null,
          });
        }
        break;
      case "video":
        if (input.videoData) {
          await db.insert(videoData).values({
            assetId,
            videoUrl: input.videoData.videoUrl ?? null,
            duration: input.videoData.duration ?? null,
          });
        }
        break;
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

    return { success: true, asset: createdAsset as AssetWithTags };
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

    // 2. 更新生成信息（如果提供）
    if (input.generationInfo) {
      const genUpdateData: Record<string, unknown> = {};
      if (input.generationInfo.prompt !== undefined)
        genUpdateData.prompt = input.generationInfo.prompt;
      if (input.generationInfo.seed !== undefined)
        genUpdateData.seed = input.generationInfo.seed;
      if (input.generationInfo.modelUsed !== undefined)
        genUpdateData.modelUsed = input.generationInfo.modelUsed;
      if (input.generationInfo.generationConfig !== undefined)
        genUpdateData.generationConfig = input.generationInfo.generationConfig;
      if (input.generationInfo.sourceAssetIds !== undefined)
        genUpdateData.sourceAssetIds = input.generationInfo.sourceAssetIds;

      if (Object.keys(genUpdateData).length > 0) {
        await db
          .update(generationInfo)
          .set(genUpdateData)
          .where(eq(generationInfo.assetId, assetId));
      }
    }

    // 3. 更新类型特定数据
    if (input.imageData) {
      const imgUpdateData: Record<string, unknown> = {};
      if (input.imageData.imageUrl !== undefined)
        imgUpdateData.imageUrl = input.imageData.imageUrl;
      if (input.imageData.thumbnailUrl !== undefined)
        imgUpdateData.thumbnailUrl = input.imageData.thumbnailUrl;

      if (Object.keys(imgUpdateData).length > 0) {
        await db
          .update(imageData)
          .set(imgUpdateData)
          .where(eq(imageData.assetId, assetId));
      }
    }

    if (input.videoData) {
      const vidUpdateData: Record<string, unknown> = {};
      if (input.videoData.videoUrl !== undefined)
        vidUpdateData.videoUrl = input.videoData.videoUrl;
      if (input.videoData.duration !== undefined)
        vidUpdateData.duration = input.videoData.duration;

      if (Object.keys(vidUpdateData).length > 0) {
        await db
          .update(videoData)
          .set(vidUpdateData)
          .where(eq(videoData.assetId, assetId));
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
        generationInfo: true,
        imageData: true,
        videoData: true,
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
      assetData.generationInfo,
      assetData.imageData,
      assetData.videoData,
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
        imageData: true,
      },
    });

    // 转换为返回格式，计算 displayUrl
    const assets = assetsData.map((a) => ({
      id: a.id,
      name: a.name,
      assetType: a.assetType as AssetTypeEnum,
      displayUrl: a.imageData?.thumbnailUrl ?? a.imageData?.imageUrl ?? null,
    }));

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

    // 2. 创建 generationInfo 记录
    await db.insert(generationInfo).values({
      assetId,
      prompt: data.prompt,
      generationConfig: JSON.stringify(data.generationConfig),
      sourceAssetIds: data.referenceAssetIds ?? null,
    });

    // 3. 创建 videoData 记录（初始为空，worker 完成后更新）
    await db.insert(videoData).values({
      assetId,
      videoUrl: null,
      duration: null,
    });

    // 4. 插入标签
    if (data.tags && data.tags.length > 0) {
      await db.insert(assetTag).values(
        data.tags.map((tagValue) => ({
          id: randomUUID(),
          assetId,
          tagValue,
        }))
      );
    }

    // 5. 创建 job 任务
    await db.insert(job).values({
      id: jobId,
      userId: session.user.id,
      projectId: data.projectId,
      type: "video_generation",
      status: "pending",
      assetId: assetId,
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

    // 2. 更新 generationInfo（如果更新 prompt）
    if (data.prompt !== undefined) {
      await db
        .update(generationInfo)
        .set({ prompt: data.prompt })
        .where(eq(generationInfo.assetId, assetId));
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

    // 2. 创建 generationInfo 记录
    await db.insert(generationInfo).values({
      assetId,
      prompt: data.prompt ?? null,
      sourceAssetIds: data.sourceAssetIds ?? null,
    });

    // 3. 创建 audioData 记录（初始为空，worker 完成后更新）
    await db.insert(audioData).values({
      assetId,
      audioUrl: null,
      duration: null,
    });

    // 4. 插入标签
    if (data.tags && data.tags.length > 0) {
      await db.insert(assetTag).values(
        data.tags.map((tagValue) => ({
          id: randomUUID(),
          assetId,
          tagValue,
        }))
      );
    }

    // 5. 创建 job 任务
    await db.insert(job).values({
      id: jobId,
      userId: session.user.id,
      projectId: data.projectId,
      type: "audio_generation",
      status: "pending",
      assetId: assetId,
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
