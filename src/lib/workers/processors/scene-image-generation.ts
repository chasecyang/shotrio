"use server";

import db from "@/lib/db";
import { sceneImage } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { generateImagePro, editImagePro } from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import type {
  SceneImageGenerationInput,
  SceneImageGenerationResult,
} from "@/types/job";
import { BaseProcessor, createProcessorHandler } from "../base-processor";

/**
 * 场景图像生成处理器
 * 为已有的场景视角（sceneImage）生成图片
 */
class SceneImageGenerationProcessor extends BaseProcessor<
  SceneImageGenerationInput,
  SceneImageGenerationResult
> {
  /**
   * 验证输入参数
   */
  protected async validate(input: SceneImageGenerationInput): Promise<void> {
    if (!input.sceneId) {
      throw new Error("缺少必要参数：sceneId");
    }
    if (!input.imageId) {
      throw new Error("缺少必要参数：imageId");
    }
  }

  /**
   * 处理场景图像生成
   */
  protected async process(
    input: SceneImageGenerationInput
  ): Promise<SceneImageGenerationResult> {
    const { sceneId, imageId, regenerate = false } = input;

    await this.updateProgress(10, "正在读取场景信息...");

    // 获取场景视角信息（包含场景信息）
    const imageRecord = await db.query.sceneImage.findFirst({
      where: eq(sceneImage.id, imageId),
      with: {
        scene: {
          with: {
            project: {
              with: {
                artStyle: true, // 关联查询项目的美术风格
              },
            },
          },
        },
      },
    });

    if (!imageRecord) {
      throw new Error("场景视角不存在");
    }

    if (!imageRecord.scene) {
      throw new Error("场景信息不存在");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scene = imageRecord.scene as any;

    if (scene.id !== sceneId) {
      throw new Error("视角与场景不匹配");
    }

    // 验证场景是否属于该项目
    if (this.job.projectId && scene.projectId !== this.job.projectId) {
      throw new Error("场景不属于该项目");
    }

    if (!imageRecord.imagePrompt) {
      throw new Error("该视角没有生成描述，无法生成图片");
    }

    await this.updateProgress(
      20,
      regenerate ? "正在重新生成图片..." : "正在生成图片..."
    );

    // 使用已保存的 imagePrompt（在创建任务时已经构建好）
    const basePrompt = imageRecord.imagePrompt;

    // 获取全局美术风格prompt（优先使用styleId关联的风格，fallback到stylePrompt）
    const globalStylePrompt =
      scene.project?.artStyle?.prompt || scene.project?.stylePrompt || "";

    // 将全局风格追加到基础prompt
    const fullPrompt = globalStylePrompt
      ? `${basePrompt}, ${globalStylePrompt}`
      : basePrompt;

    // 根据图片类型决定使用文生图还是图生图
    let result;

    if (imageRecord.imageType === "quarter_view") {
      // 叙事视角图：需要从全景布局图生成（image-to-image）
      // 查询该场景的全景布局图
      const masterLayoutRecord = await db.query.sceneImage.findFirst({
        where: and(
          eq(sceneImage.sceneId, sceneId),
          eq(sceneImage.imageType, "master_layout")
        ),
      });

      if (!masterLayoutRecord?.imageUrl) {
        throw new Error("生成叙事视角图需要先生成全景布局图");
      }

      // 使用 image-to-image 模式，从全景布局图聚焦到表演区域
      result = await editImagePro({
        prompt: fullPrompt,
        image_urls: [masterLayoutRecord.imageUrl],
        num_images: 1,
        aspect_ratio: "16:9", // 横版场景图
        resolution: "2K",
        output_format: "png",
      });
    } else {
      // 全景布局图：直接文生图
      result = await generateImagePro({
        prompt: fullPrompt,
        num_images: 1,
        aspect_ratio: "16:9", // 横版场景图
        resolution: "2K",
        output_format: "png",
      });
    }

    if (!result.images || result.images.length === 0) {
      throw new Error("生成失败，没有返回图片");
    }

    await this.updateProgress(70, "正在上传图片...");

    // 获取生成的图片
    const generatedImage = result.images[0];
    const imageUrl = generatedImage.url;
    const seed = null;

    // 上传到 R2
    let finalImageUrl = imageUrl;
    try {
      const uploadResult = await uploadImageFromUrl(
        imageUrl,
        undefined,
        this.job.userId
      );
      if (uploadResult.success && uploadResult.url) {
        finalImageUrl = uploadResult.url;
      }
    } catch (error) {
      this.logError("上传图片到 R2 失败，使用原始 URL:", error);
    }

    await this.updateProgress(90, "正在保存图片...");

    // 更新数据库中的 imageUrl 和 seed
    await db
      .update(sceneImage)
      .set({
        imageUrl: finalImageUrl,
        seed,
      })
      .where(eq(sceneImage.id, imageId));

    return {
      imageId,
      imageUrl: finalImageUrl,
    };
  }
}

/**
 * 场景图像生成处理函数
 * 导出给job-processor使用
 */
export const processSceneImageGeneration = createProcessorHandler(
  SceneImageGenerationProcessor
);

