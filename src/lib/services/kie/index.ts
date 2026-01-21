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

// 音频生成
export {
  generateSoundEffect,
  generateMusic,
  getMusicTaskDetails,
  waitForMusic,
  type SoundEffectInput,
  type SoundEffectOutput,
  type SoundEffectOutputFormat,
  type MusicGenerationInput,
  type MusicGenerationOutput,
  type SunoModel,
} from "./audio";

// Sora 2 视频生成
export {
  generateSora2Video,
  getSora2VideoDetails,
  waitForSora2Video,
  type Sora2Model,
  type Sora2AspectRatio,
  type Sora2Duration,
  type Sora2Size,
  type Sora2GenerateInput,
  type Sora2VideoOutput,
} from "./sora";

// Seedance 1.5 Pro 视频生成
export {
  generateSeedanceVideo,
  getSeedanceVideoDetails,
  waitForSeedanceVideo,
  type SeedanceDuration,
  type SeedanceAspectRatio,
  type SeedanceResolution,
  type SeedanceGenerateInput,
  type SeedanceVideoOutput,
} from "./seedance";
