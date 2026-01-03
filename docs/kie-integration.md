# Kie.ai Nano Banana 集成说明

## 概述

项目已集成 Kie.ai 的 Nano Banana 图片生成服务，作为更便宜的替代方案。

### 价格对比

| 服务商 | 价格 | 备注 |
|--------|------|------|
| Fal.ai | 标准价格 | 原始服务商 |
| Kie.ai | ~$0.02/张 | **便宜约 80%** |

### 支持的模型

- **Nano Banana** - 标准版（Gemini 2.5 Flash），无参考图
- **Nano Banana Edit** - 编辑版，支持最多10张参考图
- **Nano Banana Pro** - 高质量版（Gemini 3 Pro），支持 4K 分辨率

## 配置

### 1. 环境变量

在 `.env.local` 文件中添加：

```bash
# 图片生成服务提供商 (fal | kie)
# 默认: kie (因为更便宜)
IMAGE_SERVICE_PROVIDER=kie

# Kie.ai API Key
KIE_API_KEY=your_kie_api_key_here

# 可选：如果仍需使用 fal.ai
# FAL_KEY=your_fal_key_here
```

### 2. 获取 Kie.ai API Key

1. 访问 [https://kie.ai](https://kie.ai)
2. 注册账号并登录
3. 进入 API 设置页面获取 API Key

## 使用方式

项目已经完全适配，**无需修改任何业务代码**。所有图片生成请求会自动根据 `IMAGE_SERVICE_PROVIDER` 环境变量选择对应的服务商。

### 切换服务商

只需修改环境变量即可：

```bash
# 使用 Kie.ai（推荐，更便宜）
IMAGE_SERVICE_PROVIDER=kie

# 使用 Fal.ai（原始服务）
IMAGE_SERVICE_PROVIDER=fal
```

## 技术实现

### 文件结构

```
src/lib/services/
├── fal.service.ts      # Fal.ai 服务（保留）
├── kie.service.ts      # Kie.ai 服务（新增）
└── image.service.ts    # 统一接口（新增）
```

### 统一接口

所有使用图片生成服务的地方，现在都通过 `image.service.ts` 统一调用：

```typescript
import { generateImage, editImage } from "@/lib/services/image.service";

// 文生图
const result = await generateImage({
  prompt: "a beautiful landscape",
  aspect_ratio: "16:9",
  output_format: "png",
});

// 图生图
const editResult = await editImage({
  prompt: "change to sunset",
  image_urls: ["https://..."],
  aspect_ratio: "16:9",
});
```

### 自动适配

`image.service.ts` 会自动：
- 根据环境变量选择服务商
- 适配参数格式差异
- 处理格式转换（如 webp → png）

## API 文档

### Nano Banana (文生图)

```typescript
generateImage({
  prompt: string,
  num_images?: number,
  aspect_ratio?: AspectRatio,
  output_format?: OutputFormat,
})
```

### Nano Banana Edit (图生图)

```typescript
editImage({
  prompt: string,
  image_urls: string[],  // 最多10张
  num_images?: number,
  aspect_ratio?: AspectRatio,
  output_format?: OutputFormat,
})
```

### Nano Banana Pro (高质量)

```typescript
generateImagePro({
  prompt: string,
  image_input?: string[],  // 最多8张
  aspect_ratio?: AspectRatio,
  resolution?: "1K" | "2K" | "4K",
  output_format?: "png" | "jpg",
})
```

## 参考链接

- Kie.ai 官网: https://kie.ai
- Nano Banana 文档: https://kie.ai/nano-banana
- API 文档: https://kie.ai/docs

## 注意事项

1. **格式限制**: Kie.ai 不支持 `webp` 格式，会自动转换为 `png`
2. **参考图数量**: 
   - Nano Banana Edit: 最多 10 张
   - Nano Banana Pro: 最多 8 张
3. **宽高比**: 支持所有标准宽高比 (1:1, 16:9, 9:16, 4:3, 3:2 等)

## 迁移说明

如果之前使用 Fal.ai：

1. 添加 `KIE_API_KEY` 到环境变量
2. 设置 `IMAGE_SERVICE_PROVIDER=kie`
3. 重启服务
4. **无需修改任何代码**

所有现有的图片生成功能会自动切换到 Kie.ai。

