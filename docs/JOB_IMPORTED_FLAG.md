# 任务导入状态标记功能

## 问题描述

在场景/角色/分镜提取完成后，用户查看并执行导入操作后，提示横幅依旧存在。这是因为之前的实现使用了本地状态 `recentlyImportedJobId` 来标记已导入的任务，当页面刷新后状态丢失，横幅会重新显示。

## 解决方案

使用数据库字段来持久化任务的导入状态，而不是使用 localStorage 或组件状态。

### 1. 数据库 Schema 变更

在 `job` 表中添加 `isImported` 字段：

```typescript
// src/lib/db/schemas/project.ts
export const job = pgTable("job", {
  // ... 其他字段
  
  // 导入状态（用于提取类任务）
  isImported: boolean("is_imported").default(false).notNull(), // 是否已导入
  
  // ... 其他字段
});
```

### 2. 类型定义更新

```typescript
// src/types/job.ts
export interface Job {
  // ... 其他字段
  isImported: boolean; // 是否已导入（用于提取类任务）
  // ... 其他字段
}
```

### 3. 新增 Action

创建 `markJobAsImported` 函数用于标记任务为已导入：

```typescript
// src/lib/actions/job/user-operations.ts
export async function markJobAsImported(jobId: string): Promise<{
  success: boolean;
  error?: string;
}>;
```

### 4. 横幅组件更新

修改三个提取横幅组件，检查 `isImported` 字段：

- `src/components/projects/editor/resource-panel/scene-extraction-banner.tsx`
- `src/components/projects/characters/character-extraction-banner.tsx`
- `src/components/projects/editor/preview-panel/storyboard-extraction-banner.tsx`

**变更内容：**

1. 在查找已完成任务时，过滤掉 `isImported` 为 `true` 的任务
2. 在 `extractionJob` 的 useMemo 中检查 `completedJob.isImported`
3. 移除不再需要的 `recentlyImportedJobId` prop 和相关逻辑

### 5. 对话框组件更新

修改三个提取对话框组件，在导入成功后调用 `markJobAsImported`：

- `src/components/projects/editor/resource-panel/scene-extraction-dialog.tsx`
- `src/components/projects/characters/character-extraction-dialog.tsx`
- `src/components/projects/editor/preview-panel/storyboard-extraction-dialog.tsx`

**变更内容：**

在 `handleImport` 函数中，导入成功后添加：

```typescript
// 标记任务为已导入
await markJobAsImported(jobId);
```

### 6. 父组件更新

移除以下组件中的 `recentlyImportedJobId` 状态和相关逻辑：

- `src/components/projects/editor/resource-panel/scene-list.tsx`
- `src/components/projects/editor/resource-panel/character-list.tsx`
- `src/components/projects/editor/preview-panel/episode-editor.tsx`

## 数据库迁移

执行以下命令应用 schema 变更：

```bash
npm run db:push
```

这将在 `job` 表中添加 `is_imported` 字段，默认值为 `false`。

## 测试步骤

1. 启动场景/角色/分镜提取任务
2. 等待任务完成，查看横幅显示
3. 点击"查看并导入"按钮
4. 选择要导入的项目并确认导入
5. 验证横幅自动消失
6. **刷新页面**，验证横幅不再显示（这是关键测试点）
7. 再次提取，验证新任务的横幅正常显示

## 优势

相比使用 localStorage：

1. **数据可靠性**：数据存储在数据库中，不会因清除浏览器缓存而丢失
2. **跨设备同步**：用户在不同设备登录时，导入状态保持一致
3. **代码简洁**：移除了组件间传递 `recentlyImportedJobId` 的复杂逻辑
4. **更好的可维护性**：导入状态与任务数据绑定在一起

## 影响范围

- 数据库 schema（需要迁移）
- 3 个横幅组件
- 3 个对话框组件
- 3 个列表组件
- 1 个类型定义文件
- 1 个 action 文件

## 注意事项

- 现有数据库中的任务记录，`isImported` 字段会被设置为默认值 `false`
- 如果之前有已导入的任务，横幅可能会再次显示，用户可以点击关闭按钮或再次导入
- 该字段主要用于提取类任务（`character_extraction`、`scene_extraction`、`storyboard_generation`），其他任务类型不受影响

