# 视频生成系统重构 - 执行指导

## 背景

当前使用 Kling V2.6 Image-to-Video（分镜图=首帧），无法表现复杂镜头（如"从高处摇下"、"汤姆扑向杰瑞躲开撞柜子"）。

**解决方案**：升级到 Kling O1 Reference-to-Video API，使用引用系统（@Image, @Element）。

## 核心设计原则

1. **数据库存原子事实，不绑定模型结构**（Element 是 Kling O1 的视角，由 Agent 运行时组装）
2. **分镜可绑定关联图片**（首帧、尾帧、关键帧、相关角色/场景/道具参考图等）
3. **复用素材在生成时指定**（可从素材库灵活选择）
4. **版本化生成记录**（同一分镜可用不同素材配置多次生成）

## 数据结构

```typescript
// 1. Shot 表（分镜描述）
shot {
  id, episodeId, order,
  shotSize, cameraMovement, duration,
  description, // 中文描述
  currentVideoId // 指向当前使用的视频版本
}

// 2. Shot Asset 表（分镜关联的图片）
// 可以是：首帧、尾帧、关键帧、相关角色/场景/道具参考图等
shot_asset {
  shotId, assetId,
  label, // 语义化标签："首帧", "尾帧", "关键帧-抓绳", "汤姆-主图", "汤姆-动作参考", "厨房场景", "橱柜道具"
  order // 决定 prompt 中的引用顺序
}

// 3. Shot Video 表（生成记录，可多版本）
shot_video {
  shotId,
  
  // 生成配置（JSON）
  generationConfig: {
    prompt: string, // 包含 @label 占位符
    additionalAssets: [
      { assetId, label } // 生成时额外添加的素材
    ],
    model: "kling-o1",
    duration: "5" | "10",
    aspectRatio: "16:9" | "9:16" | "1:1"
  },
  
  // 结果
  videoUrl, status,
  createdAt
}
```

## 图片分类说明

### 分镜关联图片（shot_asset）
- **用途**：与这个分镜直接相关的图片
- **特点**：预先绑定，每次生成自动包含
- **示例**：
  - 首帧图、尾帧图、关键帧图
  - 这个镜头中出现的角色参考图（如"汤姆-奔跑姿势"）
  - 这个镜头需要的场景/道具图（如"厨房场景"、"橱柜"）
  - 分镜草图、构图参考

### 额外素材（generationConfig.additionalAssets）
- **用途**：生成时临时添加的补充素材
- **特点**：灵活指定，可以每次生成时不同
- **示例**：
  - 尝试不同的风格参考
  - 替换角色的不同参考图版本
  - 测试不同光照/色调参考

## Kling O1 API 映射

```typescript
// 生成视频时
async function generateVideo(shotId, config) {
  // 1. 查询分镜关联图片（自动包含）
  const shotAssets = await db.query.shotAsset.findMany({ 
    where: eq(shotAsset.shotId, shotId),
    orderBy: [asc(shotAsset.order)]
  })
  
  // 2. 合并额外素材
  const allAssets = [
    ...shotAssets, 
    ...(config.additionalAssets || [])
  ]
  
  // 3. Agent 根据 label 语义智能组装
  // label 包含 "主图"/"frontal"/"正面" → frontal_image_url
  // label 包含 "参考"/"reference" → reference_image_urls
  // label 包含 "首帧"/"起始"/"start" → start_frame
  // label 包含 "风格"/"style" → reference_images
  // label 包含角色名（如"汤姆"） + "主图" → element
  
  // 4. 构建 API 参数
  const klingInput = {
    prompt: config.prompt, // "Start with @首帧. @汤姆-主图 lunges toward @杰瑞-主图..."
    reference_images: [...], // 风格参考、全局参考
    elements: [
      {
        frontal_image_url: "...", // 主图
        reference_image_urls: [...] // 参考图
      }
    ],
    start_frame: "...", // 可选
    duration: config.duration,
    aspect_ratio: config.aspectRatio
  }
  
  // 5. 调用 fal.ai API
  await generateReferenceToVideo(klingInput)
}
```

## Prompt 占位符系统

**用 @label 引用图片**（不使用 @Image1、@Element1，因为没有固定的 element 表）

```
示例 Prompt：
"Start with @首帧 showing Tom on the platform. Tom leaps into air, 
at the peak (matching @关键帧-跳跃), grabs the rope using @汤姆-主图 and 
@汤姆-动作参考. Jerry (@杰瑞-主图) watches from below. 
Swings across the @厨房场景 background. 
Ends with @尾帧 landing safely. Keep style of @风格参考."
```

**Label 命名建议**：
- 时间节点：`首帧`、`尾帧`、`关键帧-{动作描述}`
- 角色相关：`{角色名}-主图`、`{角色名}-{视角/动作}`
- 场景道具：`{场景名}`、`{道具名}`
- 风格参考：`风格参考`、`光照参考`、`色调参考`

## Agent 职责

### 创建分镜时
```typescript
create_shots({
  shots: [{
    description: "汤姆从高台跳下抓绳荡到对面",
    shotSize: "full_shot",
    cameraMovement: "crane_down",
    duration: 10000,
    
    // 关联图片
    assets: [
      { assetId: "xxx", label: "首帧" },
      { assetId: "xxx", label: "关键帧-跳跃" },
      { assetId: "xxx", label: "尾帧" },
      { assetId: "xxx", label: "汤姆-主图" },
      { assetId: "xxx", label: "汤姆-跳跃动作" },
      { assetId: "xxx", label: "绳索道具" }
    ],
    
    // 建议的生成配置
    suggestedConfig: {
      prompt: "Start with @首帧 showing Tom on the high platform ready to jump...",
      duration: "10"
    }
  }]
})
```

### 生成视频时
```typescript
generate_video({
  shotId: "shot_123",
  
  // 可选：添加额外素材或覆盖配置
  config: {
    prompt: "...",
    additionalAssets: [
      { assetId: "style-ref", label: "风格参考" }
    ],
    duration: "10"
  }
})

// Agent 理解 label 语义，智能组装成 Kling O1 需要的结构
// 通过 label 关键词判断：
// - "主图"/"frontal"/"正面" → element.frontal_image_url
// - "参考"/"reference" + 角色名 → element.reference_image_urls
// - "首帧"/"起始"/"start" → start_frame
// - "风格"/"style" → reference_images
// - 角色名 + 动作/视角 → 同一 element 的 reference_image_urls
```

## 关键实现点

### 1. 数据库迁移
```sql
-- 删除旧的关联字段
ALTER TABLE shot DROP COLUMN image_asset_id;

-- 创建新表
CREATE TABLE shot_asset (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shot(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES asset(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shot_video (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shot(id) ON DELETE CASCADE,
  generation_config TEXT NOT NULL, -- JSON
  video_url TEXT,
  status TEXT NOT NULL, -- 'pending' | 'processing' | 'completed' | 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 更新 shot 表
ALTER TABLE shot ADD COLUMN current_video_id TEXT REFERENCES shot_video(id);
```

### 2. 服务函数
```typescript
// src/lib/services/fal.service.ts
export async function generateReferenceToVideo(
  input: KlingO1ReferenceToVideoInput
): Promise<ImageToVideoOutput> {
  configureFal();
  
  // 处理图片 URL
  const processedElements = await Promise.all(
    input.elements.map(async (element) => ({
      frontal_image_url: await processImageUrl(element.frontal_image_url),
      reference_image_urls: await Promise.all(
        element.reference_image_urls.map(processImageUrl)
      ),
    }))
  );
  
  const result = await fal.subscribe(
    "fal-ai/kling-video/o1/standard/reference-to-video",
    {
      input: {
        prompt: input.prompt,
        elements: processedElements,
        reference_images: input.reference_images,
        start_frame: input.start_frame,
        duration: input.duration,
        aspect_ratio: input.aspect_ratio,
        negative_prompt: input.negative_prompt,
      },
      logs: true,
    }
  );

  return result.data as ImageToVideoOutput;
}
```

### 3. Video Processor
```typescript
// src/lib/workers/processors/video-processors.ts
export async function processShotVideoGeneration(jobData: Job, workerToken: string) {
  const input = JSON.parse(jobData.inputData || "{}");
  const { shotId, videoConfigId } = input;
  
  // 1. 查询 shot_video 记录
  const shotVideo = await db.query.shotVideo.findFirst({
    where: eq(shotVideo.id, videoConfigId)
  });
  
  const config = JSON.parse(shotVideo.generationConfig);
  
  // 2. 查询分镜关联图片
  const shotAssets = await db.query.shotAsset.findMany({
    where: eq(shotAsset.shotId, shotId),
    with: { asset: true },
    orderBy: [asc(shotAsset.order)]
  });
  
  // 3. 合并额外素材
  const allAssets = [...shotAssets, ...(config.additionalAssets || [])];
  
  // 4. Agent 组装逻辑（根据 label 语义）
  const apiInput = assembleKlingO1Input(allAssets, config);
  
  // 5. 调用 API
  const result = await generateReferenceToVideo(apiInput);
  
  // 6. 更新记录
  await db.update(shotVideo).set({
    videoUrl: uploadedUrl,
    status: 'completed'
  });
}
```

### 4. Agent Function 更新
```typescript
// src/lib/actions/agent/functions.ts
{
  name: "create_shots",
  description: "创建分镜。可以关联图片（首尾帧、关键帧、角色/场景/道具参考等）",
  parameters: {
    shots: [{
      description: "分镜描述",
      shotSize, cameraMovement, duration,
      
      assets: [
        {
          assetId: "素材ID",
          label: "语义化标签（用于 prompt 引用和 Agent 理解）"
        }
      ],
      
      suggestedConfig: {
        prompt: "包含 @label 占位符的完整描述",
        duration: "5" | "10"
      }
    }]
  }
}

{
  name: "generate_shot_video",
  description: "生成分镜视频。自动包含分镜关联的图片，可添加额外素材",
  parameters: {
    shotId: "分镜ID",
    config: {
      prompt: "prompt（可选，默认使用 suggestedConfig）",
      additionalAssets: [
        { assetId, label }
      ],
      duration: "5" | "10"
    }
  }
}
```

### 5. UI 改造

#### 分镜编辑器
```
┌─────────────────────────────────────────┐
│ 分镜 #3                                  │
├─────────────────────────────────────────┤
│ 📎 关联图片                              │
│                                          │
│ ┌────┐ ┌────┐ ┌────┐                   │
│ │首帧│ │尾帧│ │关键│ + 添加图片          │
│ └────┘ └────┘ │帧  │                   │
│               └────┘                   │
│                                          │
│ ┌────┐ ┌────┐                           │
│ │汤姆│ │汤姆│ 角色参考                   │
│ │主图│ │动作│                           │
│ └────┘ └────┘                           │
│                                          │
│ ┌────┐ ┌────┐                           │
│ │厨房│ │橱柜│ 场景/道具                  │
│ └────┘ └────┘                           │
│                                          │
├─────────────────────────────────────────┤
│ 📝 Prompt:                               │
│ Start with @首帧. @汤姆-主图 lunges...  │
│                                          │
├─────────────────────────────────────────┤
│ [生成视频]  [重新生成]  [版本历史▾]     │
└─────────────────────────────────────────┘
```

#### 版本历史
```
版本 1 (当前) - 2024-01-01
  配置：使用汤姆-主图、杰瑞-主图
  [查看] [重新使用配置]

版本 2 - 2024-01-01  
  配置：使用汤姆-主图、杰瑞-主图 + 风格参考1
  [查看] [设为当前] [重新使用配置]
```

## Agent 系统提示词更新

```typescript
## 视频生成系统

使用 Kling O1 Reference-to-Video API，支持通过语义化标签引用图片。

### 创建分镜时

1. **分析分镜内容**，识别需要的图片：
   - 时间节点图：首帧、尾帧、关键帧
   - 角色图：出现的角色及其动作/视角
   - 场景/道具图：相关场景和道具

2. **查询素材库**，寻找合适的图片：
   ```typescript
   query_assets({ tagFilters: ["角色", "汤姆"] })
   ```

3. **如果缺少素材，生成新的**：
   ```typescript
   generate_assets({
     assets: [
       { name: "汤姆-奔跑", prompt: "...", tags: ["角色", "汤姆", "动作"] }
     ]
   })
   ```

4. **创建分镜并关联图片**：
   ```typescript
   create_shots({
     shots: [{
       description: "...",
       assets: [
         { assetId: "xxx", label: "首帧" },
         { assetId: "xxx", label: "汤姆-主图" },
         { assetId: "xxx", label: "汤姆-奔跑动作" }
       ],
       suggestedConfig: {
         prompt: "Start with @首帧. @汤姆-主图 runs using @汤姆-奔跑动作..."
       }
     }]
   })
   ```

### Label 命名规范

- **首尾帧**：`首帧`、`尾帧`
- **关键帧**：`关键帧-{动作描述}`，如 `关键帧-跳跃`、`关键帧-抓绳`
- **角色**：`{角色名}-主图`、`{角色名}-{视角/动作}`
  - 例：`汤姆-主图`、`汤姆-侧面`、`汤姆-奔跑`
- **场景/道具**：直接用名称，如 `厨房场景`、`橱柜`、`绳索`
- **风格参考**：`风格参考`、`光照参考`、`色调参考`

### Prompt 编写

在 prompt 中用 `@label` 引用图片：

```
Start with @首帧 showing the scene. 
@汤姆-主图 (Tom cat) lunges forward using @汤姆-奔跑动作 reference.
@杰瑞-主图 (Jerry mouse) dodges in the @厨房场景.
Camera follows the action. 
Keep the style of @风格参考.
```

### 组装逻辑

生成视频时，你需要理解 label 语义并组装成 API 需要的结构：

- **主图** (frontal_image_url)：label 包含 "主图"、"frontal"、"正面"
- **参考图** (reference_image_urls)：同一对象的其他视角/动作
- **起始帧** (start_frame)：label = "首帧"、"起始帧"
- **风格参考** (reference_images)：label 包含 "风格"、"光照"、"色调"

通过 label 中的角色名/对象名分组，构建 elements。
```

## 工作流示例

### 场景 1：AI 创建新分镜
```
1. 用户："创建一个汤姆扑向杰瑞的分镜"
2. AI 查询素材库：找到 汤姆-正面、杰瑞-正面
3. AI 创建分镜：
   - description: "汤姆扑向杰瑞，杰瑞躲开"
   - assets: [汤姆-正面, 杰瑞-正面]
   - suggestedConfig: { prompt: "..." }
4. 用户点击"生成视频"
5. 系统创建 shot_video 记录 → 调用 API → 更新结果
```

### 场景 2：用户调整优化
```
1. 视频生成完成，用户不满意动作表现
2. 用户添加"汤姆-奔跑动作"参考图到分镜
3. 修改 prompt："@汤姆-主图 lunges with @汤姆-奔跑动作..."
4. 点击"重新生成"
5. 创建新的 shot_video 记录 → 调用 API
6. 对比两个版本，选择更好的设为当前版本
```

### 场景 3：多次迭代
```
1. 第1次生成：基础配置
2. 第2次生成：+ 风格参考
3. 第3次生成：换了角色的另一张参考图
4. 第4次生成：添加了首帧和尾帧
5. 查看版本历史，选择最佳版本
```

## 迁移计划

1. ✅ 创建文档（当前文件）
2. ⬜ 数据库迁移：创建 shot_asset、shot_video 表
3. ⬜ 删除 shot.imageAssetId 字段及相关代码
4. ⬜ 实现 generateReferenceToVideo() 服务函数
5. ⬜ 实现 Agent 的 label 语义理解和组装逻辑
6. ⬜ 更新 video processor
7. ⬜ 更新 Agent functions 和 prompts
8. ⬜ UI 改造：分镜编辑器 + 版本历史
9. ⬜ 测试和优化

## 注意事项

1. **Label 是关键**：Agent 通过 label 理解图片用途，label 命名要语义清晰
2. **灵活性**：同一分镜可以绑定不同类型的图片（时间节点、角色、场景、道具等）
3. **版本化**：保留每次生成的完整配置，方便回溯和对比
4. **Agent 智能**：Agent 需要理解 label 语义，智能组装 API 参数
5. **Prompt 质量**：详细的 prompt + 准确的 @label 引用 = 更好的视频质量

---

**最后更新**: 2024-12-28

