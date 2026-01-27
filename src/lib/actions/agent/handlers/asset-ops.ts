"use server";

/**
 * 资产操作处理器
 *
 * 处理 update_asset, delete_asset, set_project_info
 */

import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import { updateAsset, deleteAsset, replaceAssetTags } from "@/lib/actions/asset";
import { updateProject } from "@/lib/actions/project/base";

/**
 * 统一的资产操作处理器
 */
export async function handleAssetOperations(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { name } = functionCall;

  switch (name) {
    case "update_asset":
      return handleUpdateAsset(functionCall);
    case "delete_asset":
      return handleDeleteAsset(functionCall);
    case "set_project_info":
      return handleSetProjectInfo(functionCall, projectId);
    default:
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `Unknown asset operation function: ${name}`,
      };
  }
}

/**
 * 更新资产
 */
async function handleUpdateAsset(
  functionCall: FunctionCall
): Promise<FunctionExecutionResult> {
  const updates = functionCall.parameters.updates as Array<{
    assetId: string;
    name?: string;
    tags?: string[];
  }>;

  const updateResults: Array<{
    assetId: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const update of updates) {
    const { assetId, name, tags } = update;

    try {
      // 更新 name
      if (name !== undefined) {
        const nameUpdateResult = await updateAsset(assetId, { name });
        if (!nameUpdateResult.success) {
          updateResults.push({
            assetId,
            success: false,
            error: nameUpdateResult.error,
          });
          continue;
        }
      }

      // 更新 tags
      if (tags !== undefined) {
        const tagsUpdateResult = await replaceAssetTags(assetId, tags);
        if (!tagsUpdateResult.success) {
          updateResults.push({
            assetId,
            success: false,
            error: tagsUpdateResult.error,
          });
          continue;
        }
      }

      updateResults.push({ assetId, success: true });
    } catch (error) {
      updateResults.push({
        assetId,
        success: false,
        error: error instanceof Error ? error.message : "Update failed",
      });
    }
  }

  const successCount = updateResults.filter((r) => r.success).length;
  const errors = updateResults
    .filter((r) => !r.success)
    .map((r) => `${r.assetId}: ${r.error}`);

  return {
    functionCallId: functionCall.id,
    success: successCount > 0,
    data: {
      updated: successCount,
      total: updates.length,
      errors: errors.length > 0 ? errors : undefined,
    },
    error:
      successCount === 0 ? `All updates failed: ${errors.join("; ")}` : undefined,
  };
}

/**
 * 删除资产
 */
async function handleDeleteAsset(
  functionCall: FunctionCall
): Promise<FunctionExecutionResult> {
  const assetIds = functionCall.parameters.assetIds as string[];
  const deleteResults: Array<{
    assetId: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const assetId of assetIds) {
    const deleteResult = await deleteAsset(assetId);
    deleteResults.push({
      assetId,
      success: deleteResult.success,
      error: deleteResult.error,
    });
  }

  const successCount = deleteResults.filter((r) => r.success).length;
  const errors = deleteResults
    .filter((r) => !r.success)
    .map((r) => `${r.assetId}: ${r.error}`);

  return {
    functionCallId: functionCall.id,
    success: successCount > 0,
    data: {
      deleted: successCount,
      total: assetIds.length,
      errors: errors.length > 0 ? errors : undefined,
    },
    error:
      successCount === 0 ? `All deletions failed: ${errors.join("; ")}` : undefined,
  };
}

/**
 * 设置项目信息
 */
async function handleSetProjectInfo(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { title, description, stylePrompt } = functionCall.parameters as {
    title?: string;
    description?: string;
    stylePrompt?: string;
  };

  // 至少需要一个字段
  if (!title && !description && !stylePrompt) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "At least one of title, description, or stylePrompt must be provided",
    };
  }

  const updateData: Record<string, string> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (stylePrompt !== undefined) updateData.stylePrompt = stylePrompt;

  const updateResult = await updateProject(projectId, updateData);

  // Build updated fields list
  const updatedFields: string[] = [];
  if (title !== undefined) updatedFields.push("title");
  if (description !== undefined) updatedFields.push("description");
  if (stylePrompt !== undefined) updatedFields.push("style");

  return {
    functionCallId: functionCall.id,
    success: updateResult.success,
    data: {
      ...updateResult.data,
      updatedFields,
    },
    error: updateResult.error,
  };
}
