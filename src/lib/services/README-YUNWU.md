# 云雾 AI 视频生成服务集成

## 概述

云雾 AI (yunwu.ai) 是一个视频生成平台提供商，支持多种 AI 视频生成模型，包括 Sora2、Sora2 Pro 和 Veo3。

## 架构设计

本项目采用**平台-模型分离**的架构：

- **平台提供商**: kie.ai, fal.ai, yunwu.ai
- **视频模型**: Sora2, Sora2 Pro, Veo 3.1, Seedance 1.5 Pro, Kling

每个模型可以独立选择使用哪个平台提供商。

## 配置方式

### 环境变量

在 `.env` 文件中配置：

```bash
# 云雾 API Key
YUNWU_API_KEY="your_api_key_here"

# 选择视频生成模型（默认: veo）
VIDEO_SERVICE_PROVIDER="veo"

# 为 Sora2 模型选择平台（默认: yunwu）
SORA2_PLATFORM="yunwu"

# 为 Veo 模型选择平台（默认: yunwu）
VEO_PLATFORM="yunwu"
```

### 配置选项

#### VIDEO_SERVICE_PROVIDER
选择使用的视频生成模型：
- `sora2` - OpenAI Sora2 标准版（支持 10s 和 15s）
- `sora2pro` - OpenAI Sora2 Pro（支持 15s 和 25s）
- `seedance` - 字节跳动 Seedance 1.5 Pro
- `veo` (默认) - Google Veo 3.1
- `kling` - 快手 Kling

#### SORA2_PLATFORM
选择 Sora2/Sora2 Pro 模型的平台提供商：
- `yunwu` (默认) - 使用 yunwu.ai 平台
- `kie` - 使用 kie.ai 平台（仅 Sora2 Pro 支持）

#### VEO_PLATFORM
选择 Veo 3.1 模型的平台提供商：
- `yunwu` (默认) - 使用 yunwu.ai 平台（使用 veo_3_1-fast-4K 模型）
- `kie` - 使用 kie.ai 平台

## 使用示例

### 使用云雾平台的 Sora2 标准版

```typescript
import { generateVideo } from "@/lib/services/video-service";

// 配置环境变量：
// VIDEO_SERVICE_PROVIDER="sora2"
// YUNWU_API_KEY="your_api_key"

const result = await generateVideo({
  prompt: "make animate",
  start_image_url: "https://example.com/image.jpg",
  aspect_ratio: "9:16",
  duration: "10", // Sora2 标准版支持 10s 和 15s
  type: "image-to-video",
});

console.log("视频URL:", result.videoUrl);
console.log("时长:", result.duration);
```

### 使用云雾平台的 Sora2 Pro

```typescript
import { generateVideo } from "@/lib/services/video-service";

// 使用云雾平台的 Sora2 Pro
// 只需确保环境变量配置：
// YUNWU_API_KEY="your_api_key"

const result = await generateVideo({
  prompt: "make animate",
  start_image_url: "https://example.com/image.jpg",
  aspect_ratio: "9:16",
  duration: "15", // Sora2 Pro 支持 15s 和 25s
  type: "image-to-video",
});

console.log("视频URL:", result.videoUrl);
console.log("时长:", result.duration);
```

### 使用 kie 平台的 Sora2 Pro

```typescript
// 环境变量配置：
// VIDEO_SERVICE_PROVIDER="sora2pro"
// SORA2_PLATFORM="kie"
// KIE_API_KEY="your_api_key"

const result = await generateVideo({
  prompt: "make animate",
  start_image_url: "https://example.com/image.jpg",
  aspect_ratio: "16:9",
  duration: "10",
  type: "image-to-video",
});
```

### 使用云雾平台的 Veo 3.1

```typescript
import { generateVideo } from "@/lib/services/video-service";

// 环境变量配置：
// VIDEO_SERVICE_PROVIDER="veo"
// VEO_PLATFORM="yunwu"
// YUNWU_API_KEY="your_api_key"

const result = await generateVideo({
  prompt: "make animate",
  start_image_url: "https://example.com/image.jpg",
  aspect_ratio: "16:9",
  type: "image-to-video",
});

console.log("视频URL:", result.videoUrl);
```

## API 参数映射

### 云雾 Sora2 标准版 API

| 参数 | 类型 | 说明 |
|------|------|------|
| `images` | string[] | 图片URL数组（起始帧和结束帧） |
| `model` | string | 固定为 "sora-2" |
| `orientation` | string | "portrait" (9:16) 或 "landscape" (16:9) |
| `prompt` | string | 视频生成提示词 |
| `size` | string | "large" 或 "small" |
| `duration` | number | 10 或 15 秒 |
| `watermark` | boolean | 水印控制（默认 false） |
| `private` | boolean | 隐私设置（默认 true） |

**分辨率和时长限制：**
- 10秒视频：支持 large 和 small
- 15秒视频：支持 large 和 small

### 云雾 Sora2 Pro API

| 参数 | 类型 | 说明 |
|------|------|------|
| `images` | string[] | 图片URL数组（起始帧和结束帧） |
| `model` | string | 固定为 "sora-2-pro-all" |
| `orientation` | string | "portrait" (9:16) 或 "landscape" (16:9) |
| `prompt` | string | 视频生成提示词 |
| `size` | string | "large" (1080p) 或 "medium" (720p) |
| `duration` | number | 15 或 25 秒 |
| `watermark` | boolean | 水印控制（默认 false） |
| `private` | boolean | 隐私设置（默认 true） |

**分辨率和时长限制：**
- 15秒视频：支持 1080p (large) 和 720p (medium)，默认使用 1080p
- 25秒视频：仅支持 720p (medium)

### 云雾 Veo3 API

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | string | 固定为 "veo_3_1-fast-4K" |
| `prompt` | string | 视频生成提示词 |
| `enhance_prompt` | boolean | 自动翻译中文提示词为英文（默认 true） |
| `enable_upsample` | boolean | 启用上采样（默认 true） |
| `images` | string[] | 图片URL数组（可选，用于帧控制） |
| `aspect_ratio` | string | "16:9" 或 "9:16"（可选） |

**特性：**
- 支持文本生成视频和图片生成视频
- 自动生成音频（Veo3 独有功能）
- 支持宽高比控制
- 支持提示词增强和上采样

### 内部配置映射

#### Sora2 标准版

```typescript
VideoGenerationConfig → YunwuSora2StandardConfig

prompt              → prompt
start_image_url     → imageUrls[0]
end_image_url       → imageUrls[1] (可选)
aspect_ratio        → orientation
  "9:16"            → "portrait"
  "16:9"            → "landscape"
duration            → duration
  "10"              → 10
  "15"              → 15
```

#### Sora2 Pro

```typescript
VideoGenerationConfig → YunwuSora2Config

prompt              → prompt
start_image_url     → imageUrls[0]
end_image_url       → imageUrls[1] (可选)
aspect_ratio        → orientation
  "9:16"            → "portrait"
  "16:9"            → "landscape"
duration            → duration
  "10"              → 15 (云雾 Pro 最小支持 15 秒)
  "15"              → 15
```

#### Veo3

```typescript
VideoGenerationConfig → YunwuVeo3Config

prompt              → prompt
start_image_url     → imageUrls[0] (可选)
end_image_url       → imageUrls[1] (可选)
aspect_ratio        → aspectRatio
  "9:16"            → "9:16"
  "16:9"            → "16:9"
enhancePrompt       → true (默认)
enableUpsample      → true (默认)
```

## 技术细节

### 文件结构

```
src/lib/services/
├── video-service.ts      # 视频服务抽象层（统一接口）
├── yunwu.ts             # 云雾平台服务实现
├── kie.ts               # kie 平台服务实现（待实现）
└── fal.ts               # fal 平台服务实现（待实现）
```

### 轮询机制

云雾 API 采用异步任务模式：
1. 创建任务 → 返回 task_id
2. 轮询查询任务状态
3. 状态为 "completed" 时返回视频URL

默认轮询配置：
- 最大轮询次数: 180 次
- 轮询间隔: 10 秒
- 总超时时间: 30 分钟

### 错误处理

```typescript
try {
  const result = await generateVideo(config);
} catch (error) {
  // 可能的错误：
  // - YUNWU_API_KEY 未设置
  // - API 请求失败
  // - 视频生成失败
  // - 轮询超时
  console.error("视频生成失败:", error);
}
```

## 扩展其他模型

如果云雾平台支持其他模型（如 Veo、Seedance），可以按照相同模式扩展：

1. 在 `yunwu.ts` 中添加新模型的函数
2. 在 `video-service.ts` 中添加平台选择逻辑
3. 添加对应的环境变量（如 `VEO_PLATFORM`）

示例：

```typescript
// yunwu.ts
export async function generateYunwuVeoVideo(config: YunwuVeoConfig) {
  // 实现云雾 Veo 视频生成
}

// video-service.ts
async function generateVideoWithVeo(config: VideoGenerationConfig) {
  const platform = process.env.VEO_PLATFORM?.toLowerCase() || "kie";

  if (platform === "yunwu") {
    return await generateVideoWithVeoYunwu(config);
  }

  return await generateVideoWithVeoKie(config);
}
```

## 参考资料

- [云雾 Sora2 API 文档](https://yunwu.apifox.cn/api-358068995)
- [云雾 Sora2 Pro API 文档](https://yunwu.apifox.cn/api-358742580)
- [云雾 Veo3 API 文档](https://yunwu.apifox.cn/api-311044999)
- [云雾官网](https://yunwu.ai)
