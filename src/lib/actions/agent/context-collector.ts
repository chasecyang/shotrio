"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { AgentContext } from "@/types/agent";
import { getProjectDetail } from "@/lib/actions/project/base";
import { queryAssets } from "@/lib/actions/asset/queries";
import { analyzeAssetsByType, getTopTagStats } from "@/lib/actions/asset/stats";

/**
 * 收集 Agent 上下文信息
 * 将当前编辑器状态转换为文本描述，供 AI 理解
 */
export async function collectContext(context: AgentContext, projectId: string): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return "用户未登录";
  }

  const parts: string[] = [];

  try {
    // 1. 项目基础信息
    const project = await getProjectDetail(projectId);
    if (project) {
      parts.push(`# 项目信息`);
      parts.push(`项目名称: ${project.title}`);
      if (project.description) {
        parts.push(`项目描述: ${project.description}`);
      }
      
      // 美术风格信息
      if (project.stylePrompt) {
        parts.push(`艺术风格: ${project.stylePrompt}`);
      } else {
        parts.push(`美术风格: 未设置（建议先设置美术风格以获得更好的图像生成效果）`);
      }
      
      parts.push("");
    }

    // 2. 项目素材统计
    if (project) {
      const assetsResult = await queryAssets({
        projectId,
        limit: 100,
      });

      if (assetsResult.assets && assetsResult.assets.length > 0) {
        parts.push(`# 项目素材`);
        parts.push(`总素材数: ${assetsResult.total || assetsResult.assets.length}`);

        // 统计各类素材
        const assetStats = await analyzeAssetsByType(assetsResult.assets);

        if (assetStats.byType.image) parts.push(`- 图片: ${assetStats.byType.image} 个`);
        if (assetStats.byType.video) parts.push(`- 视频: ${assetStats.byType.video} 个`);
        if (assetStats.byType.text) parts.push(`- 文本: ${assetStats.byType.text} 个`);
        if (assetStats.byType.audio) parts.push(`- 音频: ${assetStats.byType.audio} 个`);

        // 获取最常用的标签（前10个）
        const topTags = await getTopTagStats(projectId);
        if (topTags.length > 0) {
          parts.push(`\n最常用的标签（前10个）:`);
          topTags.forEach((tag) => {
            parts.push(`- ${tag.tagValue} (使用 ${tag.count} 次)`);
          });
        }

        parts.push("");

        // 3. 可用参考资源（用于 sourceAssetIds）
        const referenceTagKeywords = {
          character: ['角色', '人物', 'character', '三视图', '四视图'],
          scene: ['场景', 'scene', '环境'],
          prop: ['道具', 'prop', '物品']
        };

        // 筛选已完成的图片资源
        const completedAssets = assetsResult.assets.filter(
          asset => asset.assetType === 'image' && asset.runtimeStatus === 'completed'
        );

        // 按类型分类资源
        const categorizedAssets = {
          character: [] as typeof completedAssets,
          scene: [] as typeof completedAssets,
          prop: [] as typeof completedAssets
        };

        completedAssets.forEach(asset => {
          const tags = asset.tags.map(t => t.tagValue.toLowerCase());

          // 检查是否匹配角色标签
          if (referenceTagKeywords.character.some(keyword =>
            tags.some(tag => tag.includes(keyword.toLowerCase()))
          )) {
            categorizedAssets.character.push(asset);
          }
          // 检查是否匹配场景标签
          else if (referenceTagKeywords.scene.some(keyword =>
            tags.some(tag => tag.includes(keyword.toLowerCase()))
          )) {
            categorizedAssets.scene.push(asset);
          }
          // 检查是否匹配道具标签
          else if (referenceTagKeywords.prop.some(keyword =>
            tags.some(tag => tag.includes(keyword.toLowerCase()))
          )) {
            categorizedAssets.prop.push(asset);
          }
        });

        // 限制每类最多10个
        categorizedAssets.character = categorizedAssets.character.slice(0, 10);
        categorizedAssets.scene = categorizedAssets.scene.slice(0, 10);
        categorizedAssets.prop = categorizedAssets.prop.slice(0, 10);

        // 如果有任何参考资源，输出列表
        const hasReferenceAssets =
          categorizedAssets.character.length > 0 ||
          categorizedAssets.scene.length > 0 ||
          categorizedAssets.prop.length > 0;

        if (hasReferenceAssets) {
          parts.push(`# 可用参考资源`);
          parts.push(`提示: 生成分镜图时，使用 sourceAssetIds 引用这些资源以保持视觉一致性\n`);

          if (categorizedAssets.character.length > 0) {
            parts.push(`## 角色资源`);
            categorizedAssets.character.forEach(asset => {
              const tagList = asset.tags.map(t => t.tagValue).join(', ');
              parts.push(`- [${asset.id}] ${asset.name} (${tagList})`);
            });
            parts.push('');
          }

          if (categorizedAssets.scene.length > 0) {
            parts.push(`## 场景资源`);
            categorizedAssets.scene.forEach(asset => {
              const tagList = asset.tags.map(t => t.tagValue).join(', ');
              parts.push(`- [${asset.id}] ${asset.name} (${tagList})`);
            });
            parts.push('');
          }

          if (categorizedAssets.prop.length > 0) {
            parts.push(`## 道具资源`);
            categorizedAssets.prop.forEach(asset => {
              const tagList = asset.tags.map(t => t.tagValue).join(', ');
              parts.push(`- [${asset.id}] ${asset.name} (${tagList})`);
            });
            parts.push('');
          }
        }
      }
    }

    // 5. 最近的任务
    if (context.recentJobs && context.recentJobs.length > 0) {
      parts.push(`# 最近任务`);
      const recentJobsInfo = context.recentJobs
        .slice(0, 5)
        .map((job) => {
          const status = 
            job.status === "completed" ? "✅ 已完成" :
            job.status === "processing" ? "⏳ 进行中" :
            job.status === "failed" ? "❌ 失败" :
            job.status === "pending" ? "⏸️ 等待中" :
            "❓ 未知";
          return `- ${status} ${job.type} ${job.progressMessage ? `(${job.progressMessage})` : ""}`;
        });
      parts.push(recentJobsInfo.join("\n"));
      parts.push("");
    }

  } catch (error) {
    console.error("收集上下文失败:", error);
    parts.push(`收集上下文时出错: ${error instanceof Error ? error.message : "未知错误"}`);
  }

  return parts.join("\n");
}

