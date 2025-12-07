# Scene Actions

场景管理相关的 Server Actions。

## 文件结构

- `crud.ts` - 场景的基础 CRUD 操作
- `image.ts` - 场景视角图片生成和管理
- `index.ts` - 统一导出

## 核心功能

### CRUD 操作 (crud.ts)

- `upsertScene()` - 创建或更新场景
- `deleteScene()` - 删除场景

### 图片管理 (image.ts)

- `saveSceneImage()` - 保存场景视角图
- `deleteSceneImage()` - 删除场景视角图
- `setScenePrimaryImage()` - 设置主图
- `generateImageForSceneView()` - 提交图片生成任务
- `regenerateSceneViewImage()` - 重新生成图片

## 使用示例

```typescript
import { upsertScene, deleteScene } from "@/lib/actions/scene";

// 创建场景
await upsertScene(projectId, {
  name: "咖啡厅",
  description: "温馨的咖啡厅，午后阳光透过窗户",
  location: "内景",
  timeOfDay: "白天",
});

// 删除场景
await deleteScene(projectId, sceneId);
```
