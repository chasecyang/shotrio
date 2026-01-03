"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createAsset, updateAsset, getAsset } from "./crud";
import type { AssetWithTags } from "@/types/asset";

/**
 * 创建文本资产的输入类型
 */
export interface CreateTextAssetInput {
  projectId: string;
  name: string;
  content: string;
  tags?: string[];
  meta?: {
    category?: string;
    version?: number;
    author?: string;
  };
}

/**
 * 创建文本资产（语义化封装）
 * 
 * 文本资产统一使用 sourceType='uploaded'，因为无需 job 处理
 */
export async function createTextAsset(
  input: CreateTextAssetInput
): Promise<{
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

  // 验证内容长度（限制 100KB）
  if (input.content.length > 100 * 1024) {
    return { success: false, error: "文本内容过长，最大支持 100KB" };
  }

  return createAsset({
    projectId: input.projectId,
    name: input.name,
    sourceType: "uploaded", // 文本资产无需 job 处理
    textContent: input.content,
    tags: input.tags,
    meta: input.meta ? { textAsset: input.meta } : undefined,
  });
}

/**
 * 更新文本资产内容
 */
export async function updateTextAssetContent(
  assetId: string,
  content: string
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

  // 验证内容长度（限制 100KB）
  if (content.length > 100 * 1024) {
    return { success: false, error: "文本内容过长，最大支持 100KB" };
  }

  // 验证资产类型
  const assetResult = await getAsset(assetId);
  if (!assetResult.success || !assetResult.asset) {
    return { success: false, error: assetResult.error || "资产不存在" };
  }

  if (assetResult.asset.assetType !== "text") {
    return { success: false, error: "不是文本资产" };
  }

  return updateAsset(assetId, {
    textContent: content,
  });
}

/**
 * 获取文本资产内容（用于 Agent 读取）
 * 
 * 注意：为防止上下文溢出，限制返回长度为 10KB
 */
export async function getTextAssetContent(
  assetId: string
): Promise<{
  success: boolean;
  content?: string;
  name?: string;
  tags?: string[];
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  const assetResult = await getAsset(assetId);
  if (!assetResult.success || !assetResult.asset) {
    return { success: false, error: assetResult.error || "资产不存在" };
  }

  const asset = assetResult.asset;

  if (asset.assetType !== "text") {
    return { success: false, error: "不是文本资产" };
  }

  if (!asset.textContent) {
    return { success: false, error: "文本内容为空" };
  }

  // 限制返回长度为 10KB（防止 Agent 上下文溢出）
  const maxLength = 10 * 1024;
  const content = asset.textContent.length > maxLength
    ? asset.textContent.substring(0, maxLength) + "\n\n[内容已截断，完整内容请查看资产详情]"
    : asset.textContent;

  return {
    success: true,
    content,
    name: asset.name,
    tags: asset.tags.map(tag => tag.tagValue),
  };
}

/**
 * 批量获取文本资产内容（用于 Agent 查询）
 */
export async function getTextAssetsContent(
  assetIds: string[]
): Promise<{
  success: boolean;
  assets?: Array<{
    id: string;
    name: string;
    content: string;
    tags: string[];
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

  const results = await Promise.all(
    assetIds.map(id => getTextAssetContent(id))
  );

  const assets = results
    .filter(r => r.success && r.content)
    .map((r, idx) => ({
      id: assetIds[idx],
      name: r.name || "",
      content: r.content || "",
      tags: r.tags || [],
    }));

  return { success: true, assets };
}

