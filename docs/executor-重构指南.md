# Executor.ts 重构指南

## 需要替换的 4 个 case

### 1. 删除 `case "create_shots":`（第242-328行）
这个 case 已经废弃，因为不再需要创建分镜。
**操作：完全删除这个 case**

### 2. 替换 `case "generate_shot_video":` → `case "generate_video":`（第418-491行）

**旧代码（删除）：**
```typescript
case "generate_shot_video": {
  const shotId = parameters.shotId as string;
  const klingO1Config = parameters.klingO1Config as {...};
  
  const { createShotVideoGeneration } = await import("../project/shot-video");
  const generateResult = await createShotVideoGeneration({
    shotId,
    klingO1Config: normalizedConfig,
  });
  ...
}
```

**新代码（替换为）：**
```typescript
case "generate_video": {
  const prompt = parameters.prompt as string;
  const title = parameters.title as string | undefined;
  const referenceAssetIds = parameters.referenceAssetIds as string[] | undefined;
  const tags = parameters.tags as string[] | undefined;
  const order = parameters.order as number | undefined;
  const klingO1Config = parameters.klingO1Config as {
    prompt: string;
    elements?: Array<{
      frontal_image_url: string;
      reference_image_urls?: string[];
    }>;
    image_urls?: string[];
    duration?: "5" | "10";
    aspect_ratio?: "16:9" | "9:16" | "1:1";
  };

  if (!prompt || !klingO1Config || !klingO1Config.prompt) {
    result = {
      functionCallId: functionCall.id,
      success: false,
      error: "缺少必填参数：prompt 和 klingO1Config.prompt",
    };
    break;
  }

  try {
    // 参数校验
    const { validateKlingO1Config } = await import("@/lib/utils/video-validation");
    const validationResult = validateKlingO1Config(klingO1Config);
    
    if (!validationResult.valid) {
      result = {
        functionCallId: functionCall.id,
        success: false,
        error: `参数校验失败: ${validationResult.errors.join("; ")}`,
      };
      break;
    }
    
    const normalizedConfig = validationResult.normalizedConfig!;
    
    // 创建视频生成任务
    const generateResult = await createVideoGeneration({
      projectId,
      prompt,
      title,
      referenceAssetIds,
      klingO1Config: normalizedConfig,
      order,
      tags,
    });

    if (generateResult.success) {
      result = {
        functionCallId: functionCall.id,
        success: true,
        data: {
          videoId: generateResult.data?.video.id,
          jobId: generateResult.data?.jobId,
          message: "视频生成任务已创建",
        },
      };
    } else {
      result = {
        functionCallId: functionCall.id,
        success: false,
        error: generateResult.error || "创建视频生成任务失败",
      };
    }
  } catch (error) {
    result = {
      functionCallId: functionCall.id,
      success: false,
      error: error instanceof Error ? error.message : "生成视频失败",
    };
  }
  break;
}
```

### 3. 替换 `case "update_shots":` → `case "update_videos":`（第526-590行）

**旧代码（删除）：**
```typescript
case "update_shots": {
  const updates = parameters.updates as Array<{
    shotId: string;
    duration?: number;
    shotSize?: string;
    cameraMovement?: string;
    description?: string;
    visualPrompt?: string;
  }>;
  
  for (const update of updates) {
    await updateShot(update.shotId, {...});
  }
  ...
}
```

**新代码（替换为）：**
```typescript
case "update_videos": {
  const updates = parameters.updates as Array<{
    videoId: string;
    prompt?: string;
    title?: string;
    tags?: string[];
    order?: number;
  }>;

  const results = [];
  
  for (const update of updates) {
    const { videoId, ...updateData } = update;
    const updateResult = await updateVideo(videoId, updateData);
    
    if (updateResult.success) {
      results.push({
        videoId,
        success: true,
      });
    } else {
      results.push({
        videoId,
        success: false,
        error: updateResult.error,
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.length - successCount;

  result = {
    functionCallId: functionCall.id,
    success: failedCount === 0,
    data: {
      results,
      successCount,
      failedCount,
      message: `已更新 ${successCount} 个视频${failedCount > 0 ? `，${failedCount} 个失败` : ""}`,
    },
  };
  break;
}
```

### 4. 替换 `case "delete_shots":` → `case "delete_videos":`（第639-650行）

**旧代码（删除）：**
```typescript
case "delete_shots": {
  const shotIds = parameters.shotIds as string[];

  for (const shotId of shotIds) {
    await deleteShot(shotId);
  }
  ...
}
```

**新代码（替换为）：**
```typescript
case "delete_videos": {
  const videoIds = parameters.videoIds as string[];

  const deleteResult = await deleteVideos(videoIds);

  if (deleteResult.success) {
    result = {
      functionCallId: functionCall.id,
      success: true,
      data: {
        deletedCount: deleteResult.deletedCount,
        message: `已删除 ${deleteResult.deletedCount} 个视频`,
      },
    };
  } else {
    result = {
      functionCallId: functionCall.id,
      success: false,
      error: deleteResult.error || "删除视频失败",
    };
  }
  break;
}
```

## 完整的替换步骤

1. 在 `src/lib/actions/agent/executor.ts` 中找到这4个 case
2. 按照上面的说明逐个替换
3. 确保导入语句已经更新（已完成）
4. 删除对 `batchCreateShots`, `deleteShot`, `updateShot` 的引用
5. 测试编译是否通过

## 注意事项

- `createVideoGeneration` 已经在文件顶部导入
- `updateVideo` 和 `deleteVideos` 已经在文件顶部导入
- 不需要再导入 shot 相关的函数
- 确保 `projectId` 变量可用（已在 executor 开头定义）

