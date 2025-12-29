# Agent 视频生成重构：直接使用 Kling O1

## 背景

之前的实现中，Agent 调用 `generate_shot_video` 后，会由 Worker 中的另一个 AI（`assembleKlingO1Input`）来分析 label 语义并组装 Kling O1 参数。这导致：
1. Agent 无法完全控制视频生成参数
2. 增加了一层 AI 推理，可能产生误差
3. Agent 明明能感知到项目所有素材，却不能自己决定如何使用

## 重构目标

让 Agent 直接构建完整的 Kling O1 配置，Worker 只负责执行，不做任何参数推理。

## 修改内容

### 1. 修改 `generate_shot_video` Function 定义

**文件**: `src/lib/actions/agent/functions.ts`

- 参数从 `config` 改为 `klingO1Config`
- 直接接收完整的 Kling O1 API 参数结构
- 添加详细的参数说明和使用示例

```typescript
{
  name: "generate_shot_video",
  parameters: {
    shotId: string,
    klingO1Config: {
      prompt: string,              // 必填
      elements?: Array<{           // 可选：角色元素
        frontal_image_url: string,
        reference_image_urls?: string[]
      }>,
      image_urls?: string[],       // 可选：参考图（起始帧放第一位）
      duration?: "5" | "10",
      aspect_ratio?: "16:9" | "9:16" | "1:1"
    }
  }
}
```

**注意**：根据 [Kling O1 API 文档](https://fal.ai/models/fal-ai/kling-video/o1/standard/reference-to-video/api#schema-input)，API 没有单独的 `start_frame` 参数。如果要指定起始帧，将其放在 `image_urls` 的第一位，并在 prompt 中用 `@Image1` 引用（如："Take @Image1 as the start frame..."）。

### 2. 修改 Executor

**文件**: `src/lib/actions/agent/executor.ts`

- 移除了查询 shotAssets 和组装配置的逻辑
- 直接将 Agent 提供的 `klingO1Config` 传递给 `createShotVideoGeneration`
- 添加参数验证（必须有 prompt）

### 3. 修改 `createShotVideoGeneration`

**文件**: `src/lib/actions/project/shot-video.ts`

- 参数从 `config: VideoGenerationConfig` 改为 `klingO1Config: KlingO1ReferenceToVideoInput`
- 直接存储 Kling O1 配置到数据库

### 4. 修改 Worker

**文件**: `src/lib/workers/processors/video-processors.ts`

- 移除了 `assembleKlingO1Input` 调用
- 移除了查询 shotAssets 的逻辑
- 直接从数据库读取 Agent 提供的配置并调用 Kling O1 API
- 简化了整个流程，从原来的 11 步减少到 8 步

**变化对比**:
```
旧流程：
1. 加载配置
2. 查询分镜关联图片 (shotAssets)
3. AI 分析图片语义
4. 组装 Kling O1 参数
5. 计算积分
6. 扣除积分
7. 调用 Kling O1 API
8. 上传视频
9-11. 更新数据库

新流程：
1. 加载配置（已包含完整的 Kling O1 配置）
2. 计算积分
3. 扣除积分
4. 直接调用 Kling O1 API
5. 上传视频
6-8. 更新数据库
```

### 5. 更新 Agent 系统提示词

**文件**: `src/lib/services/agent-engine/prompts.ts`

添加了详细的 Kling O1 使用指南，包括：

1. **Kling O1 参数结构说明**
2. **如何构建 Kling O1 配置的步骤**:
   - 步骤1: 用 `query_shots` 查询分镜关联的素材
   - 步骤2: 根据 label 语义分类图片
   - 步骤3: 编写 prompt 并使用占位符引用图片
3. **完整示例**
4. **注意事项**

**分类规则**:
- **起始帧** (start_frame): 包含"首帧"、"起始帧"、"start"、"begin"
- **角色元素** (elements): 
  - 主图 (frontal): 包含"正面"、"主图"、"frontal"
  - 参考图: 其他视角或动作
- **全局参考** (image_urls): 包含"风格"、"场景"、"背景"、"色调"

**占位符使用**:
- `@Element1, @Element2, ...` 引用 elements
- `@Image1, @Image2, ...` 引用 image_urls
- `@StartFrame` 引用起始帧

### 6. 修改 `query_shots` 返回数据

**文件**: `src/lib/actions/project/refresh.ts`

- 添加了 `shotAssets` 的查询，包含完整的素材信息（label, imageUrl）
- Agent 可以通过这个接口获取分镜关联的所有素材

## Kling O1 使用示例

假设分镜关联了以下素材：
- "汤姆-正面" (imageUrl: "url1")
- "汤姆-跑步" (imageUrl: "url2")  
- "首帧图" (imageUrl: "url3")
- "森林场景" (imageUrl: "url4")

Agent 应该构建如下配置：

```json
{
  "shotId": "shot-123",
  "klingO1Config": {
    "prompt": "Take @Image1 as the start frame. @Element1 runs through the forest @Image2, camera follows from behind, smooth motion, cinematic lighting",
    "elements": [
      {
        "frontal_image_url": "url1",
        "reference_image_urls": ["url2"]
      }
    ],
    "image_urls": ["url3", "url4"],
    "duration": "5",
    "aspect_ratio": "16:9"
  }
}
```

**说明**：
- 起始帧放在 `image_urls[0]`，在 prompt 中用 `@Image1` 引用
- 森林场景放在 `image_urls[1]`，用 `@Image2` 引用
- 汤姆的图片作为 element，用 `@Element1` 引用

## 优势

1. **更直接**: Agent 直接控制视频生成参数，不经过第二层 AI 推理
2. **更可控**: 用户通过与 Agent 对话可以精确控制每个参数
3. **更可靠**: 减少了 AI 推理层次，降低了出错可能
4. **更高效**: Worker 只负责执行，不做复杂的语义分析
5. **更透明**: 配置直接存储，便于调试和审查

## 向后兼容

- 移除了 `VideoGenerationConfig` 类型（来自 `kling-o1-assembler.ts`）
- 保留了 `kling-o1-assembler.ts` 文件（可能在其他地方使用），但不在视频生成流程中使用
- 旧的 `generate_videos` 函数标记为废弃，建议使用新的 `generate_shot_video`

## 测试建议

1. 测试 Agent 能否正确查询 shotAssets
2. 测试 Agent 能否根据 label 正确分类图片
3. 测试 Agent 能否正确构建 Kling O1 配置
4. 测试 Worker 能否正确执行配置
5. 测试边界情况（只有 prompt、只有 elements、所有参数都有等）

## 注意事项

1. **prompt 必须是英文**：Kling O1 API 要求英文描述
2. **必须正确使用占位符**：@Element1, @Image1, @Image2 等
3. **起始帧的处理**：放在 `image_urls` 第一位，在 prompt 中用 "Take @Image1 as the start frame..." 引用
4. **图片总数限制**：elements + image_urls 最多 7 张图片
5. **imageUrl 必须是可访问的 URL**：R2 key 会自动转换为公开 URL
6. **duration 影响积分消费**：5秒/10秒分别消耗不同积分

