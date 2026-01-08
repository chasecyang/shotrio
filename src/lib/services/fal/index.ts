// Fal.ai 服务统一导出

// 配置
export { configureFal } from "./config";

// 类型定义
export type {
  // Image types
  AspectRatio,
  OutputFormat,
  GeneratedImage,
  GenerateImageOutput,
  TextToImageInput,
  ImageToImageInput,
  // Video types
  VideoGenerationType,
  ModelTier,
  VideoDuration,
  VideoAspectRatio,
  VideoFile,
  ImageToVideoInput,
  KlingO1ImageToVideoInput,
  ImageToVideoOutput,
  // Vision types
  VisionInput,
  VisionOutput,
  // Speech types
  SpeechEmotion,
  SpeechSampleRate,
  SpeechBitrate,
  SpeechFormat,
  SpeechChannel,
  SpeechVoiceSettings,
  SpeechAudioSettings,
  TextToSpeechInput,
  SpeechAudioFile,
  TextToSpeechOutput,
} from "./types";

// 图像生成 (Nano Banana)
export {
  generateImage,
  editImage,
  queueTextToImage,
  queueImageToImage,
  getQueueStatus,
  getQueueResult,
} from "./image";

// 视频生成 (Kling)
export {
  generateImageToVideo,
  queueImageToVideo,
  getImageToVideoStatus,
  getImageToVideoResult,
  generateKlingO1ImageToVideo,
} from "./video";

// 视觉分析
export { generateVisionDescription } from "./vision";

// 语音合成 (MiniMax Speech)
export {
  generateSpeech,
  queueSpeech,
  getSpeechStatus,
  getSpeechResult,
  DEFAULT_VOICE_ID,
} from "./speech";
