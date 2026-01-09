"use server";

import { createAssetInternal } from "@/lib/actions/asset/crud";
import { analyzeDescriptionForText } from "@/lib/services/ai-tagging.service";
import type { AssetTypeEnum } from "@/types/asset";

interface UploadTextAssetParams {
  projectId: string;
  userId: string;
  textContent: string;
  description: string;
}

interface UploadTextAssetResult {
  success: boolean;
  assetId?: string;
  error?: string;
}

const MAX_TEXT_SIZE = 100 * 1024; // 100KB

/**
 * 上传文本素材
 *
 * 文本素材特点：
 * - 无需 R2 存储，内容直接存入 textData 表
 * - sourceType 固定为 "uploaded"
 * - 通过 AI 分析描述生成名称和标签
 */
export async function uploadTextAsset({
  projectId,
  userId,
  textContent,
  description,
}: UploadTextAssetParams): Promise<UploadTextAssetResult> {
  try {
    // 1. 验证内容
    const trimmedContent = textContent.trim();
    if (!trimmedContent) {
      return { success: false, error: "文本内容不能为空" };
    }

    if (trimmedContent.length > MAX_TEXT_SIZE) {
      return { success: false, error: "文本内容过长，最大支持 100KB" };
    }

    // 2. AI 分析生成名称和标签
    const trimmedDescription = description.trim();
    const analysisInput = trimmedDescription || trimmedContent.slice(0, 200);
    const analysis = await analyzeDescriptionForText(analysisInput);

    // 3. 创建素材（直接存数据库，无需 R2）
    const createResult = await createAssetInternal({
      projectId,
      userId,
      name: analysis.name,
      assetType: "text" as AssetTypeEnum,
      sourceType: "uploaded",
      tags: analysis.tags,
      textData: {
        textContent: trimmedContent,
      },
    });

    if (!createResult.success) {
      return {
        success: false,
        error: createResult.error || "创建文本素材失败",
      };
    }

    return {
      success: true,
      assetId: createResult.asset?.id,
    };
  } catch (error) {
    console.error("上传文本素材失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}
