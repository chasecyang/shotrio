/**
 * 统一的图片生成服务接口
 * 
 * 支持多个服务商：
 * - fal.ai (原始服务商)
 * - kie.ai (更便宜的替代方案)
 * 
 * 通过环境变量 IMAGE_SERVICE_PROVIDER 控制使用哪个服务商
 * 默认值: "kie" (因为 kie.ai 更便宜)
 */

import type {
  AspectRatio,
  OutputFormat,
  GeneratedImage,
  GenerateImageOutput,
  TextToImageInput,
  ImageToImageInput,
} from "@/lib/services/fal.service";

// 重新导出类型供其他文件使用
export type {
  AspectRatio,
  OutputFormat,
  GeneratedImage,
  GenerateImageOutput,
  TextToImageInput,
  ImageToImageInput,
};

type ImageServiceProvider = "fal" | "kie";

/**
 * 获取当前配置的图片服务提供商
 */
function getImageServiceProvider(): ImageServiceProvider {
  const provider = process.env.IMAGE_SERVICE_PROVIDER?.toLowerCase() as ImageServiceProvider;
  
  // 默认使用 kie，因为更便宜
  if (provider !== "fal" && provider !== "kie") {
    return "kie";
  }
  
  return provider;
}

/**
 * 文生图 - 根据文本生成图片
 */
export async function generateImage(
  input: TextToImageInput
): Promise<GenerateImageOutput> {
  const provider = getImageServiceProvider();
  
  if (provider === "kie") {
    const { generateImage: kieGenerateImage } = await import("@/lib/services/kie.service");
    return kieGenerateImage(input);
  } else {
    const { generateImage: falGenerateImage } = await import("@/lib/services/fal.service");
    return falGenerateImage(input);
  }
}

/**
 * 图生图 - 基于参考图生成/编辑图片
 */
export async function editImage(
  input: ImageToImageInput
): Promise<GenerateImageOutput> {
  const provider = getImageServiceProvider();
  
  if (provider === "kie") {
    const { editImage: kieEditImage } = await import("@/lib/services/kie.service");
    return kieEditImage(input);
  } else {
    const { editImage: falEditImage } = await import("@/lib/services/fal.service");
    return falEditImage(input);
  }
}

