# 时间轴素材条拖拽功能 - 剩余工作文档

## 已完成的工作

### 1. 基础架构 ✅

**已创建的文件：**
- [asset-strip-panel.tsx](src/components/projects/editor/clipping-mode/asset-strip-panel.tsx) - 素材条主容器
- [asset-thumbnail-item.tsx](src/components/projects/editor/clipping-mode/asset-thumbnail-item.tsx) - 可拖拽的素材缩略图
- [asset-strip-drag-preview.tsx](src/components/projects/editor/clipping-mode/asset-strip-drag-preview.tsx) - 拖拽时的浮动预览
- [timeline-drag-context.tsx](src/components/projects/editor/clipping-mode/timeline-drag-context.tsx) - 拖拽状态管理

**已修改的文件：**
- [timeline-panel.tsx](src/components/projects/editor/clipping-mode/timeline-panel.tsx) - 集成了素材条和 TimelineDragProvider

### 2. 已实现的功能

✅ 素材条展开/收起（Collapsible）
✅ localStorage 持久化展开状态
✅ 加载并显示项目素材（横向滚动）
✅ 拖拽事件处理（mousedown/mousemove/mouseup）
✅ 拖拽预览（Portal 渲染，跟随鼠标）
✅ 拖拽状态管理（Context）
✅ TimelineDragProvider 集成到 TimelinePanel

### 3. 当前状态

- 代码编译通过，无错误
- 素材条显示在时间轴顶部
- 可以展开/收起素材条
- 拖拽素材时会看到跟随鼠标的预览
- **但拖拽还不能实际添加到轨道**（这是剩余工作）

---

## 剩余工作清单

### 任务 1：实现轨道的 drop zone 处理

**目标：** 让素材可以真正拖拽到轨道上

**步骤：**

1. **在 TimelinePanel 中添加全局 mouseup 监听器**
   - 位置：TimelinePanel 组件内，useEffect hook
   - 功能：
     - 当 `isDragging` 为 true 且鼠标释放时触发
     - 判断鼠标位置是否在时间轴区域内
     - 如果在轨道上，调用 `handleAssetDrop`
     - 如果在时间轴外，调用 `resetDrag()` 取消拖拽

2. **在 TimelinePanel 中添加鼠标移动监听器**
   - 位置：TimelinePanel 组件内，useEffect hook
   - 功能：
     - 当 `isDragging` 为 true 时跟踪鼠标位置
     - 使用 `getBoundingClientRect()` 获取各轨道的位置
     - 计算鼠标悬停在哪个轨道上
     - 调用 `setDropTarget(trackIndex, null)` 更新目标轨道

3. **参考代码结构：**

```typescript
// 在 TimelinePanel 组件中
import { useTimelineDrag } from "./timeline-drag-context";

const { isDragging, draggedAsset, resetDrag, setDropTarget, dropTargetTrack } = useTimelineDrag();
const timelineBodyRef = useRef<HTMLDivElement>(null);

// 监听拖拽时的鼠标移动
useEffect(() => {
  if (!isDragging) return;

  const handleMouseMove = (e: MouseEvent) => {
    if (!timelineBodyRef.current) return;

    // 计算鼠标位置对应的轨道
    // 提示：可以遍历轨道元素，使用 getBoundingClientRect() 判断
    // 找到鼠标悬停的轨道索引
    // 调用 setDropTarget(trackIndex, null)
  };

  window.addEventListener("mousemove", handleMouseMove);
  return () => window.removeEventListener("mousemove", handleMouseMove);
}, [isDragging, setDropTarget]);

// 监听鼠标释放（drop）
useEffect(() => {
  if (!isDragging) return;

  const handleMouseUp = (e: MouseEvent) => {
    if (dropTargetTrack !== null && draggedAsset) {
      // 调用 handleAssetDrop
      handleAssetDropFromDrag(draggedAsset.id, dropTargetTrack, /* 计算时间 */);
    }
    resetDrag();
  };

  window.addEventListener("mouseup", handleMouseUp);
  return () => window.removeEventListener("mouseup", handleMouseUp);
}, [isDragging, dropTargetTrack, draggedAsset, resetDrag]);
```

---

### 任务 2：连接 drop 处理器到 addClipToTimeline API

**目标：** 将拖拽的素材真正添加到时间轴

**步骤：**

1. **创建 handleAssetDropFromDrag 函数**
   - 位置：TimelinePanel 组件内
   - 签名：`async (assetId: string, trackIndex: number, startTime: number) => Promise<void>`
   - 功能：
     - 根据 assetId 从 assets 列表中查找完整的 asset 对象
     - 调用现有的 `addClipToTimeline` API
     - 成功后更新 timeline 状态
     - 显示 toast 通知

2. **修改 AssetStripPanel 的 onAssetDrop prop**
   - 当前：传入了空的 console.log 函数（第 638-641 行）
   - 修改为：传入 `handleAssetDropFromDrag`

3. **参考代码：**

```typescript
// 在 TimelinePanel 中
const handleAssetDropFromDrag = async (
  assetId: string,
  trackIndex: number,
  startTime: number
) => {
  if (!timeline) return;

  // 从素材列表中查找完整的 asset 对象
  // 提示：需要维护一个 assets 状态，或者通过 queryAssets 重新获取
  // 简单方案：在 TimelinePanel 中添加 assets 状态

  // 调用现有的 addClipToTimeline API
  const result = await addClipToTimeline(timeline.id, {
    assetId,
    trackIndex,
    startTime,
    duration: asset.duration || 0,
    trimStart: 0,
  });

  if (result.success && result.timeline) {
    updateTimeline(result.timeline);
    toast.success("已添加到时间轴");
  } else {
    toast.error(result.error || "添加失败");
  }
};
```

---

### 任务 3：添加素材类型验证

**目标：** 防止将视频素材拖到音频轨，反之亦然

**步骤：**

1. **在 handleAssetDropFromDrag 中添加类型验证**
   - 位置：handleAssetDropFromDrag 函数开头
   - 参考现有的 `handleAddAsset` 函数（line 422-462）
   - 逻辑：
     - 判断 asset.assetType === "video" 或 "audio"
     - 判断 trackIndex < 100（视频轨）还是 >= 100（音频轨）
     - 不匹配时显示 toast 错误并 return

2. **在拖拽悬停时提供视觉反馈**
   - 当素材类型不匹配时，目标轨道显示红色边框
   - 修改轨道的渲染逻辑，根据 `dropTargetTrack` 和类型匹配情况添加样式

3. **参考代码：**

```typescript
const validateAssetDrop = (asset: AssetWithFullData, trackIndex: number): boolean => {
  const isVideo = asset.assetType === "video";
  const isAudio = asset.assetType === "audio";
  const targetIsVideoTrack = isVideoTrack(trackIndex);

  if (targetIsVideoTrack && !isVideo) {
    toast.error("视频轨道只能添加视频素材");
    return false;
  }
  if (!targetIsVideoTrack && !isAudio) {
    toast.error("音频轨道只能添加音频素材");
    return false;
  }

  return true;
};

// 在 handleAssetDropFromDrag 中调用
if (!validateAssetDrop(asset, trackIndex)) {
  resetDrag();
  return;
}
```

---

### 任务 4：实现插入位置计算

**目标：** 根据鼠标位置智能计算素材插入的时间点

**步骤：**

1. **在鼠标移动监听器中计算时间位置**
   - 位置：任务 1 中的 handleMouseMove 函数
   - 功能：
     - 获取时间轴滚动容器的 scrollLeft
     - 计算鼠标相对于时间轴起点的像素位置
     - 使用 `pixelsPerMs` 转换为时间（毫秒）
     - 调用 `setDropTarget(trackIndex, timePosition)`

2. **在 drop 时使用计算的时间位置**
   - 位置：任务 1 中的 handleMouseUp 函数
   - 使用 `dropPosition`（从 context 获取）作为 startTime

3. **参考代码：**

```typescript
// 在 handleMouseMove 中
const timelineContainer = timelineBodyRef.current;
const scrollLeft = timelineContainer.scrollLeft;
const mouseX = e.clientX - timelineContainer.getBoundingClientRect().left;
const totalX = scrollLeft + mouseX;
const timePosition = totalX / pixelsPerMs; // 转换为毫秒

setDropTarget(trackIndex, timePosition);
```

---

### 任务 5：添加视觉反馈

**目标：** 让用户清楚地看到拖拽的目标位置

**步骤：**

1. **轨道高亮**
   - 位置：轨道渲染部分（videoTracks.map 和 audioTracks.map）
   - 功能：
     - 当 `dropTargetTrack === track.index` 时添加高亮样式
     - 类型匹配：`bg-primary/10 border-primary`
     - 类型不匹配：`bg-destructive/10 border-destructive`

2. **插入位置指示器**（可选，nice to have）
   - 在目标轨道上显示一条垂直线，标记素材将插入的时间位置
   - 使用绝对定位，left = `dropPosition * pixelsPerMs`

3. **播放头吸附**（可选，nice to have）
   - 当 `dropPosition` 距离 `currentTime` 小于阈值（如 20px）时
   - 自动调整 `dropPosition` 为 `currentTime`
   - 视觉上显示吸附效果（指示器变色或动画）

4. **参考代码：**

```typescript
// 在轨道渲染时
<div
  className={cn(
    "border-b flex items-center justify-between px-2 group",
    dropTargetTrack === track.index && (
      isValidDropTarget ? "bg-primary/10 border-primary" : "bg-destructive/10 border-destructive"
    )
  )}
  style={{ height: track.height }}
>
```

---

### 任务 6：处理边界情况

**目标：** 确保拖拽在各种情况下都能正常工作

**需要处理的情况：**

1. **拖拽到时间轴外**
   - 在 handleMouseUp 中判断 `dropTargetTrack === null`
   - 调用 `resetDrag()` 取消拖拽
   - 不显示任何 toast（静默取消）

2. **空素材列表**
   - 已处理：AssetStripPanel 中有空状态提示

3. **拖拽时切换轨道**
   - handleMouseMove 中实时更新 `dropTargetTrack`
   - 确保高亮跟随鼠标移动

4. **快速拖拽（未超过阈值）**
   - 已处理：AssetThumbnailItem 中有 `dragThreshold` 检查

5. **素材加载失败**
   - 在 AssetStripPanel 中已有 error handling（toast.error）

---

### 任务 7：键盘支持（可选，低优先级）

**目标：** 支持 ESC 键取消拖拽

**步骤：**

1. **在 TimelinePanel 中添加键盘监听器**
   - useEffect hook
   - 监听 `keydown` 事件
   - 如果 `isDragging && e.key === "Escape"`
   - 调用 `resetDrag()`

2. **参考代码：**

```typescript
useEffect(() => {
  if (!isDragging) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      resetDrag();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [isDragging, resetDrag]);
```

---

## 性能优化（可选，后续改进）

### 虚拟滚动

- 当素材数量 > 50 时，使用 `react-window`
- 参考计划文档中的 Phase 4 部分

### 拖拽性能优化

- 节流 mousemove 事件（16ms / 60fps）
- 使用 `requestAnimationFrame` 更新拖拽预览位置

---

## 测试清单

完成实现后，请测试以下场景：

- [ ] 展开/收起素材条，刷新页面后状态保持
- [ ] 拖拽视频素材到视频轨道，成功添加
- [ ] 拖拽音频素材到音频轨道，成功添加
- [ ] 尝试拖拽视频素材到音频轨道，显示错误提示
- [ ] 尝试拖拽音频素材到视频轨道，显示错误提示
- [ ] 拖拽到时间轴外释放鼠标，拖拽取消
- [ ] 拖拽时鼠标悬停在不同轨道上，高亮正确切换
- [ ] 拖拽时按 ESC 键，拖拽取消（如果实现了键盘支持）
- [ ] 添加的素材显示在正确的时间位置
- [ ] 快速点击素材（未拖拽），不触发拖拽

---

## 注意事项

1. **类型导入**
   - 确保导入 `AssetWithFullData` 类型：`import { AssetWithFullData } from "@/types/asset"`
   - 确保导入 `isVideoTrack` 工具函数：`import { isVideoTrack } from "@/types/timeline"`

2. **Refs 的使用**
   - 需要给时间轴主体容器添加 ref：`<div ref={timelineBodyRef} className="flex-1 overflow-auto">`
   - 用于获取滚动位置和轨道元素的边界

3. **Context 的使用**
   - TimelinePanel 已经被 TimelineDragProvider 包裹
   - 可以直接使用 `useTimelineDrag()` hook 获取拖拽状态

4. **现有函数的复用**
   - 参考 `handleAddAsset` 函数（line 422-462）的类型验证逻辑
   - 复用 `addClipToTimeline` API 调用
   - 复用 `updateTimeline` 和 toast 通知模式

5. **保持一致性**
   - 遵循现有的代码风格和命名约定
   - 使用现有的 UI 组件（Button, toast 等）
   - 保持错误处理的一致性

---

## 相关文件路径

**核心文件：**
- [timeline-panel.tsx](src/components/projects/editor/clipping-mode/timeline-panel.tsx) - 主要修改文件
- [timeline-drag-context.tsx](src/components/projects/editor/clipping-mode/timeline-drag-context.tsx) - 拖拽状态管理
- [asset-strip-panel.tsx](src/components/projects/editor/clipping-mode/asset-strip-panel.tsx) - 素材条

**类型定义：**
- [asset.ts](src/types/asset.ts) - AssetWithFullData 类型
- [timeline.ts](src/types/timeline.ts) - TrackConfig, isVideoTrack 等

**API：**
- [clip-actions.ts](src/lib/actions/timeline/clip-actions.ts) - addClipToTimeline 函数

---

## 预期完成时间

- 任务 1-4（核心功能）：2-3 小时
- 任务 5（视觉反馈）：1 小时
- 任务 6（边界情况）：30 分钟
- 任务 7（键盘支持）：15 分钟
- 测试和调试：1 小时

**总计：约 5-6 小时**

---

## 最终效果

完成后，用户可以：

1. 点击时间轴顶部展开素材条
2. 看到所有项目素材的缩略图
3. 拖拽素材到目标轨道
4. 看到清晰的视觉反馈（轨道高亮、拖拽预览）
5. 素材自动添加到正确的时间位置
6. 类型不匹配时看到错误提示
7. 拖拽到时间轴外可以取消操作

这将大大改善素材添加的用户体验，符合视频编辑软件的行业标准（Premiere Pro / Final Cut 风格）。
