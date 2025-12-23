"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { AgentContext } from "@/types/agent";
import { getProjectDetail } from "@/lib/actions/project/base";
import { refreshEpisodeShots } from "@/lib/actions/project/refresh";
import { queryAssets } from "@/lib/actions/asset/queries";
import { analyzeAssetsByType, getTopTagStats } from "@/lib/actions/asset/stats";

/**
 * 收集 Agent 上下文信息
 * 将当前编辑器状态转换为文本描述，供 AI 理解
 */
export async function collectContext(context: AgentContext): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return "用户未登录";
  }

  const parts: string[] = [];

  try {
    // 1. 项目基础信息
    const project = await getProjectDetail(context.projectId);
    if (project) {
      parts.push(`# 项目信息`);
      parts.push(`项目ID: ${context.projectId}`);  // ✅ 添加项目 ID
      parts.push(`项目名称: ${project.title}`);
      if (project.description) {
        parts.push(`项目描述: ${project.description}`);
      }
      
      // 美术风格信息（优先显示新的artStyle，fallback到旧的stylePrompt）
      if (project.artStyle) {
        parts.push(`美术风格: ${project.artStyle.name} (${project.artStyle.prompt})`);
        if (project.artStyle.description) {
          parts.push(`风格描述: ${project.artStyle.description}`);
        }
      } else if (project.stylePrompt) {
        parts.push(`艺术风格: ${project.stylePrompt}`);
      } else {
        parts.push(`美术风格: 未设置（建议先设置美术风格以获得更好的图像生成效果）`);
      }
      
      parts.push(`剧集数量: ${project.episodes.length}`);
      parts.push("");
    }

    // 2. 当前选中的剧集
    if (context.selectedEpisodeId && project) {
      const episode = project.episodes.find((ep) => ep.id === context.selectedEpisodeId);
      if (episode) {
        parts.push(`# 当前剧集`);
        parts.push(`剧集ID: ${context.selectedEpisodeId}`);  // ✅ 添加剧集 ID
        parts.push(`剧集: ${episode.title}`);
        if (episode.summary) {
          parts.push(`梗概: ${episode.summary}`);
        }
        
        // 剧本状态（不显示具体内容，需要时可通过 query_script_content 查询）
        if (episode.scriptContent && episode.scriptContent.trim()) {
          parts.push(`剧本内容: 已有剧本（${episode.scriptContent.length} 字）`);
        } else {
          parts.push(`剧本内容: 暂无`);
        }
        parts.push("");
      }
    }

    // 3. 选中的分镜
    if (context.selectedShotIds && context.selectedShotIds.length > 0 && context.selectedEpisodeId) {
      parts.push(`# 选中的分镜`);
      parts.push(`已选中 ${context.selectedShotIds.length} 个分镜`);
      
      const result = await refreshEpisodeShots(context.selectedEpisodeId);
      if (result.success && result.shots) {
        const selectedShots = result.shots.filter((s) =>
          context.selectedShotIds.includes(s.id)
        );
        
        // 只显示前 5 个分镜的详情
        const shotsToShow = selectedShots.slice(0, 5);
        parts.push(`\n分镜详情（前${shotsToShow.length}个）:`);
        shotsToShow.forEach((shot) => {
          parts.push(`- 分镜 #${shot.order}: ${shot.description || "无描述"}`);
          parts.push(`  景别: ${shot.shotSize}, 运镜: ${shot.cameraMovement}, 时长: ${shot.duration}ms`);
          if (shot.imageAsset?.imageUrl) {
            parts.push(`  状态: 已生成图片`);
          }
          if (shot.videoUrl) {
            parts.push(`  状态: 已生成视频`);
          }
        });
        
        if (selectedShots.length > 5) {
          parts.push(`...还有 ${selectedShots.length - 5} 个分镜`);
        }
      }
      parts.push("");
    }

    // 4. 选中的资源（如素材）
    if (context.selectedResource) {
      parts.push(`# 当前选中资源`);
      parts.push(`类型: ${context.selectedResource.type}`);
      parts.push(`ID: ${context.selectedResource.id}`);
      parts.push("");
    }

    // 5. 项目素材统计
    if (project) {
      const assetsResult = await queryAssets({
        projectId: context.projectId,
        limit: 100,
      });
      
      if (assetsResult.assets && assetsResult.assets.length > 0) {
        parts.push(`# 项目素材`);
        parts.push(`总素材数: ${assetsResult.total || assetsResult.assets.length}`);
        
        // 统计各类素材
        const assetStats = await analyzeAssetsByType(assetsResult.assets);
        
        if (assetStats.byType.character) parts.push(`- 角色: ${assetStats.byType.character} 个`);
        if (assetStats.byType.scene) parts.push(`- 场景: ${assetStats.byType.scene} 个`);
        if (assetStats.byType.prop) parts.push(`- 道具: ${assetStats.byType.prop} 个`);
        if (assetStats.byType.other) parts.push(`- 其他: ${assetStats.byType.other} 个`);
        
        if (assetStats.withoutImage > 0) {
          parts.push(`- 待生成图片: ${assetStats.withoutImage} 个`);
        }
        
        // 获取最常用的标签（前10个）
        const topTags = await getTopTagStats(context.projectId);
        if (topTags.length > 0) {
          parts.push(`\n最常用的标签（前10个）:`);
          topTags.forEach((tag) => {
            parts.push(`- ${tag.tagValue} (使用 ${tag.count} 次)`);
          });
        }
        
        parts.push("");
      }
    }

    // 6. 最近的任务
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

