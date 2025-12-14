# 后台任务"查看结果"优化

## 问题

之前的实现有两个问题：

1. **页面刷新问题**：点击"查看结果"使用 `window.location.href` 跳转，会刷新整个页面，用户体验不好
2. **冗余组件**：`TaskCenter` 组件是冗余的，实际使用的是 `BackgroundTasks` 组件

## 解决方案

### 1. 删除冗余组件

删除了 `src/components/tasks/task-center.tsx`，统一使用 `BackgroundTasks` 组件。

### 2. 通过 Context 打开对话框

不使用页面跳转，而是通过 EditorContext 直接打开分镜预览对话框，避免页面刷新。

## 实现细节

### 1. EditorContext 扩展

**添加对话框状态**：

```typescript
export interface EditorState {
  // ... 其他状态
  storyboardExtractionDialog: {
    open: boolean;
    episodeId: string | null;
    jobId: string | null;
  };
}
```

**添加动作类型**：

```typescript
type EditorAction =
  | // ... 其他动作
  | { type: "OPEN_STORYBOARD_EXTRACTION_DIALOG"; payload: { episodeId: string; jobId: string } }
  | { type: "CLOSE_STORYBOARD_EXTRACTION_DIALOG" };
```

**添加 Reducer 处理**：

```typescript
case "OPEN_STORYBOARD_EXTRACTION_DIALOG":
  return {
    ...state,
    storyboardExtractionDialog: {
      open: true,
      episodeId: action.payload.episodeId,
      jobId: action.payload.jobId,
    },
    // 同时切换到对应的剧集
    selectedEpisodeId: action.payload.episodeId,
    selectedResource: { type: "episode", id: action.payload.episodeId },
  };

case "CLOSE_STORYBOARD_EXTRACTION_DIALOG":
  return {
    ...state,
    storyboardExtractionDialog: {
      open: false,
      episodeId: null,
      jobId: null,
    },
  };
```

**添加便捷方法**：

```typescript
const openStoryboardExtractionDialog = useCallback((episodeId: string, jobId: string) => {
  dispatch({ type: "OPEN_STORYBOARD_EXTRACTION_DIALOG", payload: { episodeId, jobId } });
}, []);

const closeStoryboardExtractionDialog = useCallback(() => {
  dispatch({ type: "CLOSE_STORYBOARD_EXTRACTION_DIALOG" });
}, []);
```

### 2. BackgroundTasks 组件优化

**使用 Context 方法**：

```typescript
export function BackgroundTasks() {
  const { jobs: activeJobs } = useTaskSubscription();
  const { openStoryboardExtractionDialog } = useEditor();
  // ...

  const handleView = (jobId: string) => {
    const job = allJobs.find((j) => j.id === jobId);
    
    switch (job.type) {
      case "storyboard_generation": {
        const inputData = JSON.parse(job.inputData);
        const episodeId = inputData.episodeId;
        
        if (episodeId) {
          // 直接打开对话框，不刷新页面
          openStoryboardExtractionDialog(episodeId, jobId);
        }
        break;
      }
      // ... 其他任务类型
    }
  };
}
```

### 3. EpisodeEditor 组件适配

**从 Context 读取对话框状态**：

```typescript
export function EpisodeEditor({ episode }: EpisodeEditorProps) {
  const { state, closeStoryboardExtractionDialog } = useEditor();
  
  // 本地对话框状态（用于手动打开）
  const [localDialogOpen, setLocalDialogOpen] = useState(false);
  const [localJobId, setLocalJobId] = useState<string | null>(null);

  // 合并 context 和本地的对话框状态
  const isDialogOpen = state.storyboardExtractionDialog.open || localDialogOpen;
  const dialogJobId = state.storyboardExtractionDialog.jobId || localJobId;
  const dialogEpisodeId = state.storyboardExtractionDialog.episodeId || episode.id;

  // 关闭对话框
  const handleCloseDialog = () => {
    if (state.storyboardExtractionDialog.open) {
      closeStoryboardExtractionDialog();
    }
    setLocalDialogOpen(false);
    setLocalJobId(null);
  };

  return (
    <>
      {/* ... */}
      {dialogJobId && (
        <StoryboardExtractionDialog
          episodeId={dialogEpisodeId}
          jobId={dialogJobId}
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseDialog();
            }
          }}
          // ...
        />
      )}
    </>
  );
}
```

## 优势

1. **无刷新体验**：点击查看结果直接打开对话框，不需要刷新页面
2. **智能切换**：自动切换到对应的剧集，并打开对话框
3. **状态统一**：通过 Context 管理对话框状态，更容易维护
4. **双向触发**：
   - 从后台任务触发（通过 Context）
   - 从横幅触发（通过本地状态）
   - 两者互不冲突

## 关于分镜提取的两个任务

用户提到的"分镜提取是两个任务"是正确的：

```
storyboard_generation (父任务)
  ├─> storyboard_basic_extraction (子任务1: AI 提取)
  └─> storyboard_matching (子任务2: 角色场景匹配)
```

**当前的处理**：
- 后台任务显示的是 `storyboard_generation` 父任务
- 父任务的 `resultData` 包含 `matchingJobId` 指向匹配任务
- 对话框会自动加载匹配任务的结果

**为什么这样设计**：
1. 父任务作为整个流程的入口，方便用户跟踪
2. 子任务自动创建和执行，用户无需关心内部细节
3. 只有当所有子任务完成后，才会显示"查看结果"按钮

## 测试流程

1. 在剧集编辑器中启动分镜提取
2. 等待任务完成
3. 点击右上角的后台任务图标
4. 在任务列表中找到"分镜提取"任务
5. 点击"查看结果"按钮
6. **应该直接打开分镜预览对话框，不刷新页面**
7. 可以预览和导入分镜
8. 导入后该任务不再显示"查看结果"按钮

## 文件修改

- ✅ `src/components/projects/editor/editor-context.tsx` - 添加对话框状态管理
- ✅ `src/components/projects/layout/background-tasks.tsx` - 使用 Context 打开对话框
- ✅ `src/components/projects/editor/preview-panel/episode-editor.tsx` - 适配 Context 状态
- ❌ `src/components/tasks/task-center.tsx` - 删除冗余组件

## 未来优化

1. 为角色提取和场景提取添加类似的对话框
2. 支持批量查看多个任务结果
3. 在对话框中显示任务的详细信息（耗时、token 消耗等）
4. 添加任务结果的缓存，避免重复加载

