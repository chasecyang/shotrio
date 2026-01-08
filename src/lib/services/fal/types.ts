// Fal.ai 共享类型定义

// ============= Image Types (Nano Banana) =============

export type AspectRatio =
  | "21:9"
  | "16:9"
  | "3:2"
  | "4:3"
  | "5:4"
  | "1:1"
  | "4:5"
  | "3:4"
  | "2:3"
  | "9:16";

export type OutputFormat = "jpeg" | "png" | "webp";

export interface GeneratedImage {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
  file_data?: string;
}

export interface GenerateImageOutput {
  images: GeneratedImage[];
  description: string;
}

export interface TextToImageInput {
  prompt: string;
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
  sync_mode?: boolean;
}

export interface ImageToImageInput {
  prompt: string;
  image_urls: string[]; // 可以提供多张参考图（最多14张）
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
  sync_mode?: boolean;
}

// ============= Video Types (Kling) =============

export type VideoGenerationType = "image-to-video" | "video-to-video";
export type ModelTier = "standard" | "pro";
export type VideoDuration = "5" | "10";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1";

export interface VideoFile {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
}

export interface ImageToVideoInput {
  prompt: string;
  image_url: string;
  duration?: VideoDuration;
  negative_prompt?: string;
  generate_audio?: boolean;
}

export interface KlingO1ImageToVideoInput {
  prompt: string;
  start_image_url: string; // 起始帧（必填）
  end_image_url?: string; // 结束帧（可选）
  duration?: VideoDuration;
  aspect_ratio?: VideoAspectRatio;
  negative_prompt?: string;
}

export interface ImageToVideoOutput {
  video: VideoFile;
}

// ============= Vision Types =============

export interface VisionInput {
  imageUrl: string;
  prompt?: string;
}

export interface VisionOutput {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  message?: string;
  text?: string;
  output?: string;
}

// ============= Speech Types (MiniMax) =============

export type SpeechEmotion =
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "neutral";

export type SpeechSampleRate = 8000 | 16000 | 22050 | 24000 | 32000 | 44100;
export type SpeechBitrate = 32000 | 64000 | 128000 | 256000;
export type SpeechFormat = "mp3" | "pcm" | "flac";
export type SpeechChannel = 1 | 2;

export interface SpeechVoiceSettings {
  voice_id?: string;
  speed?: number; // 0.5-2.0, default 1
  vol?: number; // 0-10, default 1
  pitch?: number; // -12 to 12, default 0
  emotion?: SpeechEmotion;
}

export interface SpeechAudioSettings {
  sample_rate?: SpeechSampleRate;
  bitrate?: SpeechBitrate;
  format?: SpeechFormat;
  channel?: SpeechChannel;
}

export interface TextToSpeechInput {
  prompt: string; // Text to synthesize (required)
  voice_id?: string; // Default: "Wise_Woman"
  speed?: number; // 0.5-2.0
  vol?: number; // 0-10
  pitch?: number; // -12 to 12
  emotion?: SpeechEmotion;
  sample_rate?: SpeechSampleRate;
  bitrate?: SpeechBitrate;
  format?: SpeechFormat;
  channel?: SpeechChannel;
  language_boost?: string;
}

export interface SpeechAudioFile {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
}

export interface TextToSpeechOutput {
  audio: SpeechAudioFile;
  duration_ms: number;
}
