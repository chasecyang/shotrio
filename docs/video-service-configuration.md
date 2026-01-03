# 视频服务配置指南

本项目支持多个视频生成服务提供商，可以通过环境变量灵活切换。

## 支持的服务提供商

### 1. Kling O1 (默认)

**提供商**: fal.ai  
**模型**: Kling Video O1 Standard  
**特点**:
- 支持首尾帧过渡 (image-to-video)
- 支持多图参考生成 (reference-to-video)
- 支持视频续写 (video-to-video)
- 支持角色一致性 (elements)
- 原生音频生成

**价格**: 按秒计费，具体见 `CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND`

### 2. Veo 3.1

**提供商**: kie.ai (Google)  
**模型**: Veo 3.1 Fast / Quality  
**特点**:
- Google 最新的视频生成模型
- 价格为 Google 官方的 25%
- 支持纯文本生成视频 (TEXT_2_VIDEO)
- 支持首尾帧过渡 (FIRST_AND_LAST_FRAMES_2_VIDEO)
- 支持参考图生成 (REFERENCE_2_VIDEO)
- 多语言提示词支持（自动翻译）
- 原生 16:9 和 9:16 支持

**限制**:
- REFERENCE_2_VIDEO 模式最多3张图片
- 不支持视频续写 (video-to-video)
- 视频时长约8秒（固定）

## 环境变量配置

### 基础配置

在 `.env` 文件中添加以下配置：

```bash
# 视频服务提供商选择
# 可选值: "kling" (默认) | "veo"
VIDEO_SERVICE_PROVIDER=kling

# Kling 服务配置 (fal.ai)
FAL_KEY=your_fal_api_key

# Veo 服务配置 (kie.ai)
KIE_API_KEY=your_kie_api_key
```

### 切换到 Veo 3.1

如果要使用 Veo 3.1 服务，只需修改环境变量：

```bash
VIDEO_SERVICE_PROVIDER=veo
KIE_API_KEY=your_kie_api_key
```

### 回退到 Kling O1

如果要回退到 Kling O1（默认），设置：

```bash
VIDEO_SERVICE_PROVIDER=kling
FAL_KEY=your_fal_api_key
```

或者直接移除 `VIDEO_SERVICE_PROVIDER` 环境变量（默认使用 Kling）。

## 使用方法

### 在代码中使用

系统会自动根据环境变量选择服务提供商，无需修改业务代码：

```typescript
import { generateVideo } from "@/lib/services/video-service";

// 自动使用配置的服务提供商
const result = await generateVideo({
  type: "image-to-video",
  prompt: "A beautiful sunset over the ocean",
  start_image_url: "asset-123",
  duration: "5",
  aspect_ratio: "16:9",
});
```

### 通过 Agent 使用

Agent 的 `generate_video_asset` 功能会自动使用配置的服务：

```json
{
  "name": "generate_video_asset",
  "parameters": {
    "videoGenerationType": "image-to-video",
    "imageToVideoConfig": {
      "prompt": "Smooth camera push-in from winter to spring",
      "start_image_url": "asset-winter",
      "end_image_url": "asset-spring",
      "duration": "5"
    },
    "title": "季节过渡"
  }
}
```

## 服务对比

| 特性 | Kling O1 | Veo 3.1 |
|------|----------|---------|
| 首尾帧过渡 | ✅ | ✅ |
| 多图参考生成 | ✅ (最多7张) | ✅ (最多3张) |
| 视频续写 | ✅ | ❌ |
| 角色一致性 | ✅ (elements) | ⚠️ (需转换) |
| 纯文本生成 | ⚠️ (需单独调用) | ✅ |
| 视频时长 | 5秒或10秒 | 约8秒(固定) |
| 宽高比 | 16:9, 9:16, 1:1 | 16:9, 9:16, Auto |
| 音频 | ✅ | ✅ |
| 多语言 | ⚠️ (英文优先) | ✅ (自动翻译) |
| 价格 | 标准价格 | Google 官方的 25% |

## 最佳实践

### 选择 Kling O1 的场景

- 需要视频续写功能
- 需要精确的角色一致性控制
- 需要使用多张参考图（>3张）
- 需要灵活控制视频时长（5秒或10秒）

### 选择 Veo 3.1 的场景

- 追求更高的性价比
- 需要多语言提示词支持
- 纯文本生成视频
- 简单的首尾帧过渡
- 不超过3张参考图的场景

## 故障排查

### 问题：视频生成失败

1. 检查环境变量是否正确配置
2. 确认 API Key 是否有效
3. 查看日志中的错误信息

### 问题：Veo 3.1 视频续写不工作

**原因**: Veo 3.1 不支持视频续写功能

**解决方案**: 
- 切换到 Kling O1: `VIDEO_SERVICE_PROVIDER=kling`
- 或者提取视频关键帧作为参考图使用

### 问题：参考图超过限制

**Veo 3.1 限制**: REFERENCE_2_VIDEO 模式最多3张图片

**解决方案**:
- 减少参考图数量到3张以内
- 或切换到 Kling O1（支持最多7张）

## 开发建议

### 本地开发

建议使用 Kling O1，功能更全面：

```bash
VIDEO_SERVICE_PROVIDER=kling
```

### 生产环境

根据成本和需求选择：

- **成本优先**: 使用 Veo 3.1
- **功能优先**: 使用 Kling O1
- **混合使用**: 根据任务类型动态切换（需额外开发）

## 架构说明

视频服务采用了插拔式架构设计：

```
┌─────────────────────────────────────┐
│   Agent / Business Logic            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   video-service.ts (抽象层)          │
│   - generateVideo()                  │
│   - getVideoServiceProvider()        │
└─────────────┬───────────────────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
┌──────────┐  ┌──────────────┐
│ Kling    │  │ Veo 3.1      │
│ Adapter  │  │ Adapter      │
└──────────┘  └──────────────┘
       │             │
       ▼             ▼
┌──────────┐  ┌──────────────┐
│ fal.ai   │  │ kie.ai       │
└──────────┘  └──────────────┘
```

### 核心文件

- `src/lib/services/video-service.ts` - 统一抽象层
- `src/lib/services/fal.service.ts` - Kling 服务实现
- `src/lib/services/kie.service.ts` - Veo 3.1 服务实现
- `src/lib/workers/processors/video-processors.ts` - Worker 处理器

## 未来扩展

该架构支持轻松添加新的视频服务提供商：

1. 在对应的 service 文件中实现 API 调用
2. 在 `video-service.ts` 中添加新的适配器
3. 更新 `VideoServiceProvider` 类型
4. 添加环境变量配置

例如，添加 Runway Gen-3:

```typescript
// video-service.ts
export type VideoServiceProvider = "kling" | "veo" | "runway";

async function generateVideoWithRunway(config: VideoGenerationConfig) {
  // 实现 Runway 适配器
}

export async function generateVideo(config: VideoGenerationConfig) {
  const provider = getVideoServiceProvider();
  
  switch (provider) {
    case "runway":
      return await generateVideoWithRunway(config);
    case "veo":
      return await generateVideoWithVeo(config);
    case "kling":
    default:
      return await generateVideoWithKling(config);
  }
}
```

## 相关文档

- [Kling O1 API 文档](https://fal.ai/models/fal-ai/kling-video/o1)
- [Veo 3.1 API 文档](https://docs.kie.ai/veo3-api/generate-veo-3-video)
- [KIE 集成指南](./kie-integration.md)

