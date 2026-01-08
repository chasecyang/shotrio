// Kie.ai 服务统一导出

// 图像生成
export {
  generateImage,
  editImage,
  generateImagePro,
  type AspectRatio,
  type ImageSize,
  type OutputFormat,
  type GeneratedImage,
  type GenerateImageOutput,
  type TextToImageInput,
  type ImageToImageInput,
  type NanoBananaProInput,
} from "./image";

// 视频生成
export {
  generateVeo3Video,
  getVeo3VideoDetails,
  waitForVeo3Video,
  type Veo3Model,
  type Veo3AspectRatio,
  type Veo3GenerationType,
  type Veo3GenerateResponse,
  type Veo3VideoDetails,
  type Veo3GenerateInput,
  type Veo3VideoOutput,
} from "./video";
