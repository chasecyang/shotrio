"use server";

/**
 * 文本资产处理器
 *
 * 处理 create_text_asset
 */

import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import { createTextAsset } from "@/lib/actions/asset/text-asset";

/**
 * 统一的文本资产处理器
 */
export async function handleTextAssetFunctions(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { name } = functionCall;

  switch (name) {
    case "create_text_asset":
      return handleCreateTextAsset(functionCall, projectId);
    default:
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `Unknown text asset function: ${name}`,
      };
  }
}

/**
 * 创建文本资产
 */
async function handleCreateTextAsset(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { parameters } = functionCall;
  const name = parameters.name as string;
  const content = parameters.content as string;
  const tags = (parameters.tags as string[]) || [];

  const createResult = await createTextAsset({
    projectId,
    name,
    content,
    tags,
  });

  if (createResult.success) {
    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        assetId: createResult.asset?.id,
        name: createResult.asset?.name,
      },
    };
  } else {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: createResult.error || "Failed to create text asset",
    };
  }
}
