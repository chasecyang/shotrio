"use server";

import db from "@/lib/db";
import { characterImage, sceneImage, episode } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import type { 
  Job,
  CharacterImageGenerationInput,
  SceneImageGenerationInput,
  CharacterExtractionInput,
  StoryboardGenerationInput,
  StoryboardBasicExtractionInput,
  StoryboardMatchingInput,
  NovelSplitInput,
} from "@/types/job";

export interface JobDetails {
  id: string;
  type: string;
  displayTitle: string;
  displaySubtitle?: string;
}

/**
 * 获取任务的详细显示信息
 */
export async function getJobDetails(job: Partial<Job>): Promise<JobDetails> {
  const baseDetails: JobDetails = {
    id: job.id!,
    type: job.type!,
    displayTitle: getTaskTypeLabel(job.type!),
  };

  if (!job.inputData) {
    return baseDetails;
  }

  try {
    const inputData = JSON.parse(job.inputData);

    switch (job.type) {
      case "character_image_generation": {
        const input = inputData as CharacterImageGenerationInput;
        
        // 查询角色和造型信息
        const imageRecord = await db.query.characterImage.findFirst({
          where: eq(characterImage.id, input.imageId),
          with: {
            character: true,
          },
        });

        if (imageRecord) {
          baseDetails.displayTitle = imageRecord.character.name;
          baseDetails.displaySubtitle = `造型: ${imageRecord.label}`;
        }
        break;
      }

      case "scene_image_generation": {
        const input = inputData as SceneImageGenerationInput;
        
        // 查询场景和视角信息
        const imageRecord = await db.query.sceneImage.findFirst({
          where: eq(sceneImage.id, input.imageId),
          with: {
            scene: true,
          },
        });

        if (imageRecord) {
          baseDetails.displayTitle = imageRecord.scene.name;
          baseDetails.displaySubtitle = `视角: ${imageRecord.label}`;
        }
        break;
      }

      case "character_extraction": {
        // 如果任务已完成，显示提取的角色数量
        if (job.status === "completed" && job.resultData) {
          try {
            const resultData = JSON.parse(job.resultData);
            const characterCount = resultData.characterCount || resultData.characters?.length || 0;
            baseDetails.displayTitle = "角色提取";
            baseDetails.displaySubtitle = `已提取 ${characterCount} 个角色`;
          } catch {
            const input = inputData as CharacterExtractionInput;
            const episodeCount = input.episodeIds.length;
            baseDetails.displaySubtitle = `${episodeCount} 个剧集`;
          }
        } else {
          const input = inputData as CharacterExtractionInput;
          const episodeCount = input.episodeIds.length;
          baseDetails.displaySubtitle = `分析 ${episodeCount} 个剧集`;
        }
        break;
      }

      case "storyboard_generation": {
        const input = inputData as StoryboardGenerationInput;
        
        // 查询剧集信息
        const episodeRecord = await db.query.episode.findFirst({
          where: eq(episode.id, input.episodeId),
        });

        if (episodeRecord) {
          baseDetails.displaySubtitle = `剧集: ${episodeRecord.title}`;
        }
        break;
      }

      case "storyboard_basic_extraction": {
        const input = inputData as StoryboardBasicExtractionInput;
        
        // 查询剧集信息
        const episodeRecord = await db.query.episode.findFirst({
          where: eq(episode.id, input.episodeId),
        });

        if (episodeRecord) {
          baseDetails.displaySubtitle = `剧集: ${episodeRecord.title}`;
        }
        break;
      }

      case "storyboard_matching": {
        const input = inputData as StoryboardMatchingInput;
        
        // 查询剧集信息
        const episodeRecord = await db.query.episode.findFirst({
          where: eq(episode.id, input.episodeId),
        });

        if (episodeRecord) {
          baseDetails.displaySubtitle = `剧集: ${episodeRecord.title}`;
        }
        break;
      }

      case "novel_split": {
        const input = inputData as NovelSplitInput;
        const wordCount = input.content.length;
        baseDetails.displaySubtitle = `约 ${Math.floor(wordCount / 1000)}k 字`;
        break;
      }
    }
  } catch (error) {
    console.error("解析任务详情失败:", error);
  }

  return baseDetails;
}

/**
 * 批量获取任务详情
 */
export async function getJobsDetails(jobs: Partial<Job>[]): Promise<Map<string, JobDetails>> {
  const detailsMap = new Map<string, JobDetails>();
  
  await Promise.all(
    jobs.map(async (job) => {
      if (job.id) {
        const details = await getJobDetails(job);
        detailsMap.set(job.id, details);
      }
    })
  );

  return detailsMap;
}

function getTaskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    novel_split: "小说拆分",
    character_extraction: "角色提取",
    scene_extraction: "场景提取",
    character_image_generation: "角色造型生成",
    scene_image_generation: "场景视角生成",
    storyboard_generation: "分镜提取",
    storyboard_basic_extraction: "基础分镜提取",
    storyboard_matching: "角色场景匹配",
    batch_image_generation: "批量图像生成",
    video_generation: "视频生成",
  };
  return labels[type] || "未知任务";
}
