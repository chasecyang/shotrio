# Nano Banana Pro 图像生成 API 使用指南

本文档介绍如何使用集成的 Nano Banana Pro API 进行场景和角色图像生成。

## 🎨 模型介绍

### Nano Banana Pro（Gemini 3 Pro Image）

- **架构**: Google Gemini 3 Pro Image
- **定价**: $0.15/张（4K 双倍价格）
- **特点**:
  - 高质量语义理解
  - 优秀的文本渲染能力
  - 角色一致性（最多5人）
  - 多图输入（最多14张）
  - 支持自然语言精确编辑

## 📦 服务层接口

### 基础服务 (`src/lib/services/fal.service.ts`)

#### 1. 文生图（Text to Image）

```typescript
import { generateImagePro } from "@/lib/services/fal.service";

const result = await generateImagePro({
  prompt: "一个现代城市的街道场景，傍晚时分，霓虹灯闪烁",
  num_images: 1,
  aspect_ratio: "16:9",
  resolution: "2K",
  output_format: "png",
});
```

#### 2. 图生图/编辑（Image to Image）

```typescript
import { editImagePro } from "@/lib/services/fal.service";

const result = await editImagePro({
  prompt: "将这个角色的服装改成西装，保持面部特征不变",
  image_urls: ["https://example.com/character.jpg"],
  num_images: 1,
  aspect_ratio: "auto",
  resolution: "2K",
  output_format: "png",
});
```

#### 3. 队列方式（适用于批量任务）

```typescript
import { 
  queueTextToImagePro, 
  getQueueStatusPro, 
  getQueueResultPro 
} from "@/lib/services/fal.service";

// 提交任务
const { request_id } = await queueTextToImagePro({
  prompt: "角色描述...",
  num_images: 4,
});

// 查询状态
const status = await getQueueStatusPro(request_id, "text-to-image");

// 获取结果
const result = await getQueueResultPro(request_id, "text-to-image");
```

## 🎬 业务层接口（Server Actions）

### 场景图像生成 (`src/lib/actions/image-generation-actions.ts`)

#### 1. 生成场景图像

```typescript
import { generateSceneImage } from "@/lib/actions/image-generation-actions";

const result = await generateSceneImage({
  description: "一个安静的咖啡厅内部，木质装修，温暖的灯光，窗外是繁华的街道",
  aspectRatio: "16:9",
  resolution: "2K",
  numImages: 1,
});

if (result.success) {
  console.log(result.images); // 包含 url 和 r2Key
  console.log(result.description);
}
```

#### 2. 批量生成场景（队列）

```typescript
import { queueSceneImageGeneration } from "@/lib/actions/image-generation-actions";

const result = await queueSceneImageGeneration({
  description: "海滩日落场景",
  aspectRatio: "16:9",
  resolution: "2K",
  numImages: 4,
});

if (result.success) {
  console.log(result.requestId);
}
```

### 角色图像生成

#### 1. 生成角色图像

```typescript
import { generateCharacterImage } from "@/lib/actions/image-generation-actions";

const result = await generateCharacterImage({
  characterDescription: "一位30岁的亚洲女性，短发，专业装扮，自信的表情，摄影棚灯光",
  aspectRatio: "3:4",
  resolution: "2K",
  numImages: 1,
});
```

#### 2. 编辑角色图像

```typescript
import { editCharacterImage } from "@/lib/actions/image-generation-actions";

const result = await editCharacterImage({
  originalImageUrls: [
    "https://r2.example.com/character-original.png"
  ],
  editPrompt: "将发色改为棕色，添加眼镜",
  aspectRatio: "auto",
  resolution: "2K",
  numImages: 1,
});
```

#### 3. 角色场景合成

将角色放入特定场景，保持角色一致性：

```typescript
import { composeCharacterInScene } from "@/lib/actions/image-generation-actions";

const result = await composeCharacterInScene({
  characterImageUrls: [
    "https://r2.example.com/character1.png",
    "https://r2.example.com/character2.png"
  ],
  sceneImageUrl: "https://r2.example.com/beach-scene.png",
  compositionPrompt: "两位角色站在海滩上对话，日落背景，电影感构图",
  aspectRatio: "16:9",
  resolution: "2K",
});
```

### 队列状态查询

#### 查询生成状态

```typescript
import { getImageGenerationStatus } from "@/lib/actions/image-generation-actions";

const result = await getImageGenerationStatus({
  requestId: "xxx-xxx-xxx",
  modelType: "text-to-image",
});

console.log(result.status); // "IN_PROGRESS" | "COMPLETED" | "FAILED"
```

#### 获取生成结果

```typescript
import { getImageGenerationResult } from "@/lib/actions/image-generation-actions";

const result = await getImageGenerationResult({
  requestId: "xxx-xxx-xxx",
  modelType: "text-to-image",
});

if (result.success) {
  console.log(result.images); // 自动上传到 R2 的图片
}
```

## 🎯 使用场景示例

### 场景 1: 剧本场景生成

```typescript
// 根据剧本描述生成场景图
const sceneResult = await generateSceneImage({
  description: `
    第一幕：咖啡厅内部
    - 时间：下午3点
    - 氛围：温馨、安静
    - 装修：现代简约风格，木质家具
    - 灯光：自然光从落地窗洒入
    - 细节：吧台上有咖啡机，墙上挂着艺术画
  `,
  aspectRatio: "16:9",
  resolution: "2K",
});
```

### 场景 2: 角色形象设计

```typescript
// 第一步：生成初始角色
const characterResult = await generateCharacterImage({
  characterDescription: `
    角色：李明
    - 年龄：35岁
    - 性别：男
    - 外貌：中等身材，短发，戴眼镜
    - 服装：休闲西装
    - 气质：成熟稳重
    - 风格：真实摄影风格
  `,
  aspectRatio: "3:4",
  resolution: "2K",
  numImages: 4, // 生成4个变体供选择
});

// 第二步：选择最佳版本后进行微调
if (characterResult.success && characterResult.images) {
  const refinedResult = await editCharacterImage({
    originalImageUrls: [characterResult.images[0].url],
    editPrompt: "调整光照更加柔和，增强专业感",
    aspectRatio: "auto",
    resolution: "2K",
  });
}
```

### 场景 3: 分镜图生成

```typescript
// 将角色放入场景，生成分镜效果
const shotResult = await composeCharacterInScene({
  characterImageUrls: [
    "https://r2.example.com/characters/liming.png",
    "https://r2.example.com/characters/wangli.png"
  ],
  sceneImageUrl: "https://r2.example.com/scenes/cafe.png",
  compositionPrompt: `
    镜头：中景
    角度：平视
    构图：李明和王丽坐在咖啡厅窗边对话
    动作：李明正在说话，王丽认真倾听
    情绪：轻松但认真的交流氛围
    灯光：自然光从窗外照入，形成温暖的氛围
  `,
  aspectRatio: "16:9",
  resolution: "2K",
});
```

### 场景 4: 批量生成（队列方式）

```typescript
// 批量生成多个场景
const scenes = [
  "第一幕：咖啡厅内部场景",
  "第二幕：城市街道夜景",
  "第三幕：公园长椅场景",
  "第四幕：办公室场景",
];

const requestIds = await Promise.all(
  scenes.map(description =>
    queueSceneImageGeneration({
      description,
      aspectRatio: "16:9",
      resolution: "2K",
    })
  )
);

// 轮询检查所有任务状态
const results = await Promise.all(
  requestIds.map(async ({ requestId }) => {
    if (!requestId) return null;
    
    // 等待任务完成
    let status;
    do {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResult = await getImageGenerationStatus({
        requestId,
        modelType: "text-to-image",
      });
      status = statusResult.status;
    } while (status === "IN_PROGRESS");
    
    // 获取结果
    return await getImageGenerationResult({
      requestId,
      modelType: "text-to-image",
    });
  })
);
```

## ⚙️ 参数说明

### AspectRatio（宽高比）

- `"16:9"` - 适合场景、分镜（宽屏）
- `"3:4"` - 适合角色立绘（竖版）
- `"1:1"` - 方形
- `"21:9"` - 超宽屏幕
- `"auto"` - 自动（仅图生图）

### Resolution（分辨率）

- `"1K"` - 1024px（快速预览）
- `"2K"` - 2048px（推荐，质量与速度平衡）
- `"4K"` - 4096px（最高质量，双倍价格）

### OutputFormat（输出格式）

- `"png"` - 推荐，无损压缩
- `"jpeg"` - 文件较小
- `"webp"` - 现代格式，平衡质量与大小

## 💡 最佳实践

### 1. Prompt 编写技巧

**场景描述：**
```
清晰描述：时间、地点、氛围、光线、风格
示例：一个现代咖啡厅内部，下午时分，温暖的自然光从落地窗洒入，木质装修，
      简约风格，景深效果，电影级光照，专业摄影
```

**角色描述：**
```
包含要素：年龄、性别、外貌、服装、表情、姿态、光线、风格
示例：30岁亚洲女性，职业装扮，短发，自信的微笑，正面半身像，
      摄影棚灯光，商业摄影风格，高清细节
```

### 2. 多图输入技巧

图生图可以组合多张参考图（最多14张）：
- **角色一致性**：提供同一角色的多角度照片
- **场景参考**：提供场景风格参考图
- **构图参考**：提供构图灵感图

### 3. 成本优化

- 预览使用 `1K` 分辨率
- 正式生成使用 `2K` 分辨率
- 仅关键镜头使用 `4K` 分辨率
- 批量任务使用队列方式

### 4. 错误处理

所有接口都返回统一的错误格式：

```typescript
if (!result.success) {
  console.error(result.error);
  // 处理错误情况
}
```

## 🔧 环境配置

确保在 `.env` 文件中配置：

```bash
FAL_KEY=your_fal_api_key
```

## 📚 相关文档

- [Nano Banana Pro API 文档](https://fal.ai/models/fal-ai/nano-banana-pro/api)
- [Nano Banana Pro 图生图文档](https://fal.ai/models/fal-ai/nano-banana-pro/edit)
- [FAL AI 客户端文档](https://www.npmjs.com/package/@fal-ai/client)

## 🎨 前端集成示例

### React 组件示例

```typescript
'use client';

import { useState } from 'react';
import { generateSceneImage } from '@/lib/actions/image-generation-actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';

export function SceneGenerator() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<Array<{ url: string }>>([]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateSceneImage({
        description: prompt,
        aspectRatio: '16:9',
        resolution: '2K',
      });

      if (result.success && result.images) {
        setImages(result.images);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="描述你想要的场景..."
        rows={4}
      />
      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? '生成中...' : '生成场景'}
      </Button>
      <div className="grid grid-cols-2 gap-4">
        {images.map((img, idx) => (
          <Image
            key={idx}
            src={img.url}
            alt={`Generated scene ${idx + 1}`}
            width={800}
            height={450}
            className="rounded-lg"
          />
        ))}
      </div>
    </div>
  );
}
```

## ✅ 下一步

集成完成后，你可以：

1. 在剧本编辑页面添加场景生成按钮
2. 在角色管理页面添加角色形象生成功能
3. 在分镜页面实现角色与场景的合成
4. 实现批量生成和管理功能

