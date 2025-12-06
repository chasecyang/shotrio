# 图像生成功能快速入门

## 🚀 5分钟快速上手

### 1. 配置 API Key

在项目根目录创建 `.env.local` 文件（如果还没有），添加：

```bash
FAL_KEY=your_fal_api_key_here
```

获取 FAL API Key：https://fal.ai/dashboard/keys

### 2. 基础使用

#### 方式一：使用前端组件（最简单）

```typescript
import { ImageGenerationPanel } from "@/components/projects/image-generation-panel";

export default function YourPage() {
  return <ImageGenerationPanel />;
}
```

这个组件提供了完整的 UI，包括：
- 角色生成
- 场景生成  
- 图像编辑
- 参数配置

#### 方式二：使用 Server Actions（自定义UI）

```typescript
"use client";

import { useState } from "react";
import { generateCharacterImage } from "@/lib/actions/image-generation-actions";

export function MyCustomGenerator() {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    
    const result = await generateCharacterImage({
      characterDescription: "一位年轻的亚洲女性，职业装扮",
      aspectRatio: "3:4",
      resolution: "2K",
    });

    if (result.success && result.images?.[0]) {
      setImageUrl(result.images[0].url);
    }
    
    setLoading(false);
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? "生成中..." : "生成角色"}
      </button>
      {imageUrl && <img src={imageUrl} alt="Generated" />}
    </div>
  );
}
```

### 3. 常用场景

#### 场景 1: 为角色生成形象

```typescript
import { generateCharacterImage } from "@/lib/actions/image-generation-actions";

// 生成角色
const result = await generateCharacterImage({
  characterDescription: `
    角色名：李明
    年龄：30岁
    性别：男
    外貌：短发，戴眼镜，中等身材
    服装：商务休闲装
    表情：自信的微笑
  `,
  aspectRatio: "3:4",
  resolution: "2K",
  numImages: 4, // 生成4个变体供选择
});
```

#### 场景 2: 为剧本场景生成背景图

```typescript
import { generateSceneImage } from "@/lib/actions/image-generation-actions";

// 生成场景
const result = await generateSceneImage({
  description: `
    咖啡厅内部，下午时分
    温暖的自然光从窗外洒入
    现代简约装修风格
    木质家具，绿植装饰
    景深效果，电影感
  `,
  aspectRatio: "16:9",
  resolution: "2K",
});
```

#### 场景 3: 微调和编辑已有图像

```typescript
import { editCharacterImage } from "@/lib/actions/image-generation-actions";

// 编辑图像
const result = await editCharacterImage({
  originalImageUrls: ["https://your-image-url.jpg"],
  editPrompt: "将发型改为长发，添加眼镜，调整光照更加柔和",
  resolution: "2K",
});
```

#### 场景 4: 将角色放入场景

```typescript
import { composeCharacterInScene } from "@/lib/actions/image-generation-actions";

// 合成角色和场景
const result = await composeCharacterInScene({
  characterImageUrls: [
    "https://character1.jpg",
    "https://character2.jpg"
  ],
  sceneImageUrl: "https://scene.jpg",
  compositionPrompt: "两位角色在咖啡厅对话，中景镜头，电影感构图",
  aspectRatio: "16:9",
  resolution: "2K",
});
```

### 4. 参数说明速查

#### 宽高比 (aspectRatio)

| 值 | 用途 | 适合场景 |
|---|---|---|
| `"3:4"` | 竖版 | 角色立绘 |
| `"16:9"` | 宽屏 | 场景、分镜 |
| `"1:1"` | 方形 | 头像、通用 |
| `"21:9"` | 超宽 | 电影感场景 |

#### 分辨率 (resolution)

| 值 | 说明 | 成本 | 用途 |
|---|---|---|---|
| `"1K"` | 1024px | $0.15 | 快速预览 |
| `"2K"` | 2048px | $0.15 | **推荐** |
| `"4K"` | 4096px | $0.30 | 关键镜头 |

### 5. 最佳实践

#### ✅ 好的 Prompt

```typescript
// 详细、具体、包含关键信息
const goodPrompt = `
30岁亚洲女性，职业装扮，黑色短发，
自信的表情，正面半身像，摄影棚灯光，
商业摄影风格，高清细节，专业构图
`;
```

#### ❌ 不好的 Prompt

```typescript
// 太简单、缺少细节
const badPrompt = "一个女人";
```

#### 成本优化建议

```typescript
// 1. 预览阶段使用 1K
const preview = await generateCharacterImage({
  characterDescription: prompt,
  resolution: "1K", // 快速预览
  numImages: 4,
});

// 2. 确定后生成高质量版本
const final = await generateCharacterImage({
  characterDescription: prompt,
  resolution: "2K", // 正式版本
  numImages: 1,
});

// 3. 仅关键镜头使用 4K
const hero = await generateSceneImage({
  description: keyScenePrompt,
  resolution: "4K", // 关键镜头
  numImages: 1,
});
```

### 6. 错误处理

所有 API 都返回统一格式，方便错误处理：

```typescript
const result = await generateCharacterImage({...});

if (result.success) {
  // 成功
  const imageUrl = result.images[0].url;
  const r2Key = result.images[0].r2Key; // 可用于后续引用
} else {
  // 失败
  console.error(result.error);
  // 显示错误提示
}
```

### 7. 与数据库集成示例

```typescript
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schemas/project";
import { generateCharacterImage } from "@/lib/actions/image-generation-actions";

async function createCharacterWithImage(
  projectId: string,
  characterData: {
    name: string;
    description: string;
  }
) {
  // 1. 生成角色图像
  const imageResult = await generateCharacterImage({
    characterDescription: characterData.description,
    aspectRatio: "3:4",
    resolution: "2K",
  });

  if (!imageResult.success || !imageResult.images?.[0]) {
    throw new Error("生成图像失败");
  }

  // 2. 保存到数据库
  const [character] = await db.insert(characters).values({
    projectId,
    name: characterData.name,
    description: characterData.description,
    imageUrl: imageResult.images[0].r2Key, // 保存 R2 key
  }).returning();

  return character;
}
```

### 8. 批量处理示例

```typescript
import {
  queueSceneImageGeneration,
  getImageGenerationStatus,
  getImageGenerationResult,
} from "@/lib/actions/image-generation-actions";

async function batchGenerateScenes(sceneDescriptions: string[]) {
  // 1. 提交所有任务到队列
  const requests = await Promise.all(
    sceneDescriptions.map(description =>
      queueSceneImageGeneration({
        description,
        aspectRatio: "16:9",
        resolution: "2K",
      })
    )
  );

  // 2. 轮询检查状态
  const results = [];
  for (const req of requests) {
    if (!req.requestId) continue;

    // 等待完成
    let status = "IN_PROGRESS";
    while (status === "IN_PROGRESS") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResult = await getImageGenerationStatus({
        requestId: req.requestId,
      });
      status = statusResult.status || "IN_PROGRESS";
    }

    // 获取结果
    const result = await getImageGenerationResult({
      requestId: req.requestId,
    });
    results.push(result);
  }

  return results;
}
```

## 📚 更多文档

- [完整 API 文档](./image-generation-api.md)
- [集成总结](./nano-banana-pro-integration.md)

## 🆘 常见问题

### Q: 生成速度慢？
A: Nano Banana Pro 优先质量，平均需要 10-30 秒。批量任务使用队列方式。

### Q: 成本如何？
A: 每张图片 $0.15（2K），4K 双倍（$0.30）。建议预览用 1K/2K，关键镜头用 4K。

### Q: 如何保持角色一致性？
A: 使用 `editImagePro` 或 `composeCharacterInScene`，提供角色参考图（最多5人）。

### Q: 图片保存在哪里？
A: 自动上传到 Cloudflare R2，返回 `r2Key` 供后续引用。

### Q: 如何提高生成质量？
A: 
1. 写详细的 prompt（包含年龄、外貌、服装、光线、风格等）
2. 使用 2K 或 4K 分辨率
3. 生成多个变体（`numImages: 4`）选择最佳
4. 使用图生图微调

## 🎉 开始使用

现在你已经了解了所有基础知识，开始在你的项目中使用 AI 图像生成吧！

```typescript
import { ImageGenerationPanel } from "@/components/projects/image-generation-panel";

export default function Page() {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">AI 图像生成</h1>
      <ImageGenerationPanel />
    </div>
  );
}
```

