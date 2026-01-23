"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { AgentContext } from "@/types/agent";
import { getProjectDetail } from "@/lib/actions/project/base";
import { queryAssets } from "@/lib/actions/asset/queries";
import { analyzeAssetsByType, getTopTagStats } from "@/lib/actions/asset/stats";

/**
 * Context string translations
 * These are internal strings for AI context, not user-facing UI
 */
const contextStrings = {
  en: {
    userNotLoggedIn: "User not logged in",
    projectInfo: "# Project Information",
    projectName: "Project Name",
    projectDescription: "Project Description",
    artStyle: "Art Style",
    notSet: "Not set",
    notSetHint: "Not set (recommend setting art style for better image generation)",
    projectAssets: "# Project Assets",
    totalAssets: "Total Assets",
    images: "Images",
    videos: "Videos",
    text: "Text",
    audio: "Audio",
    topTags: "\nTop Tags (Top 10):",
    usedTimes: "used {count} times",
    availableReferenceAssets: "# Available Reference Assets",
    referenceHint: "Tip: When generating storyboard images, use sourceAssetIds to reference these assets for visual consistency\n",
    characterAssets: "## Character Assets",
    sceneAssets: "## Scene Assets",
    propAssets: "## Prop Assets",
    recentTasks: "# Recent Tasks",
    completed: "✅ Completed",
    processing: "⏳ Processing",
    failed: "❌ Failed",
    pending: "⏸️ Pending",
    unknown: "❓ Unknown",
    contextError: "Error collecting context: {error}",
  },
  zh: {
    userNotLoggedIn: "用户未登录",
    projectInfo: "# 项目信息",
    projectName: "项目名称",
    projectDescription: "项目描述",
    artStyle: "艺术风格",
    notSet: "未设置",
    notSetHint: "未设置（建议先设置美术风格以获得更好的图像生成效果）",
    projectAssets: "# 项目素材",
    totalAssets: "总素材数",
    images: "图片",
    videos: "视频",
    text: "文本",
    audio: "音频",
    topTags: "\n最常用的标签（前10个）:",
    usedTimes: "使用 {count} 次",
    availableReferenceAssets: "# 可用参考资源",
    referenceHint: "提示: 生成分镜图时，使用 sourceAssetIds 引用这些资源以保持视觉一致性\n",
    characterAssets: "## 角色资源",
    sceneAssets: "## 场景资源",
    propAssets: "## 道具资源",
    recentTasks: "# 最近任务",
    completed: "✅ 已完成",
    processing: "⏳ 进行中",
    failed: "❌ 失败",
    pending: "⏸️ 等待中",
    unknown: "❓ 未知",
    contextError: "收集上下文时出错: {error}",
  },
};

/**
 * Helper function to get translated string
 */
function t(locale: "en" | "zh", key: keyof typeof contextStrings.en, params?: Record<string, string | number>): string {
  let text = contextStrings[locale][key];
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}

/**
 * 收集 Agent 上下文信息
 * 将当前编辑器状态转换为文本描述，供 AI 理解
 */
export async function collectContext(
  context: AgentContext,
  projectId: string,
  locale: "en" | "zh" = "en"
): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return t(locale, "userNotLoggedIn");
  }

  const parts: string[] = [];

  try {
    // 1. 项目基础信息
    const project = await getProjectDetail(projectId);
    if (project) {
      parts.push(t(locale, "projectInfo"));
      parts.push(`${t(locale, "projectName")}: ${project.title}`);
      if (project.description) {
        parts.push(`${t(locale, "projectDescription")}: ${project.description}`);
      }

      // 美术风格信息
      if (project.stylePrompt) {
        parts.push(`${t(locale, "artStyle")}: ${project.stylePrompt}`);
      } else {
        parts.push(`${t(locale, "artStyle")}: ${t(locale, "notSetHint")}`);
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
        parts.push(t(locale, "projectAssets"));
        parts.push(`${t(locale, "totalAssets")}: ${assetsResult.total || assetsResult.assets.length}`);

        // 统计各类素材
        const assetStats = await analyzeAssetsByType(assetsResult.assets);

        if (assetStats.byType.image) parts.push(`- ${t(locale, "images")}: ${assetStats.byType.image} 个`);
        if (assetStats.byType.video) parts.push(`- ${t(locale, "videos")}: ${assetStats.byType.video} 个`);
        if (assetStats.byType.text) parts.push(`- ${t(locale, "text")}: ${assetStats.byType.text} 个`);
        if (assetStats.byType.audio) parts.push(`- ${t(locale, "audio")}: ${assetStats.byType.audio} 个`);

        // 获取最常用的标签（前10个）
        const topTags = await getTopTagStats(projectId);
        if (topTags.length > 0) {
          parts.push(t(locale, "topTags"));
          topTags.forEach((tag) => {
            parts.push(`- ${tag.tagValue} (${t(locale, "usedTimes", { count: tag.count })})`);
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
          parts.push(t(locale, "availableReferenceAssets"));
          parts.push(t(locale, "referenceHint"));

          if (categorizedAssets.character.length > 0) {
            parts.push(t(locale, "characterAssets"));
            categorizedAssets.character.forEach(asset => {
              const tagList = asset.tags.map(t => t.tagValue).join(', ');
              parts.push(`- [${asset.id}] ${asset.name} (${tagList})`);
            });
            parts.push('');
          }

          if (categorizedAssets.scene.length > 0) {
            parts.push(t(locale, "sceneAssets"));
            categorizedAssets.scene.forEach(asset => {
              const tagList = asset.tags.map(t => t.tagValue).join(', ');
              parts.push(`- [${asset.id}] ${asset.name} (${tagList})`);
            });
            parts.push('');
          }

          if (categorizedAssets.prop.length > 0) {
            parts.push(t(locale, "propAssets"));
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
      parts.push(t(locale, "recentTasks"));
      const recentJobsInfo = context.recentJobs
        .slice(0, 5)
        .map((job) => {
          const status =
            job.status === "completed" ? t(locale, "completed") :
            job.status === "processing" ? t(locale, "processing") :
            job.status === "failed" ? t(locale, "failed") :
            job.status === "pending" ? t(locale, "pending") :
            t(locale, "unknown");
          return `- ${status} ${job.type} ${job.progressMessage ? `(${job.progressMessage})` : ""}`;
        });
      parts.push(recentJobsInfo.join("\n"));
      parts.push("");
    }

  } catch (error) {
    console.error("收集上下文失败:", error);
    parts.push(t(locale, "contextError", { error: error instanceof Error ? error.message : "Unknown error" }));
  }

  return parts.join("\n");
}

