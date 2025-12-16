# 批量导出分镜视频功能实现总结

## 功能概述

实现了在时间轴工具栏批量导出选中分镜视频的功能，支持：
1. **批量选择分镜** - 在时间轴中选择多个分镜
2. **自动筛选** - 自动跳过未生成视频的分镜
3. **ZIP 打包** - 将所有视频打包成一个 ZIP 文件
4. **友好命名** - 视频文件按照 shot-001.mp4, shot-002.mp4 格式命名
5. **实时进度** - 显示打包进度和完成状态

## 实现内容

### 1. Server Action

**文件**: `src/lib/actions/video/export.ts`

#### 主要函数

- `getExportableShots(shotIds: string[])`
  - 验证用户登录状态和权限
  - 查询选中分镜的数据
  - 筛选出有 `videoUrl` 的分镜
  - 按 `order` 排序返回
  - 返回统计信息（总数、可导出数、跳过数）

#### 返回类型

```typescript
type ExportableShotData = {
  id: string;
  order: number;
  videoUrl: string;
}

type GetExportableShotsResult = {
  success: boolean;
  shots?: ExportableShotData[];
  totalSelected: number;
  totalExportable: number;
  skippedCount: number;
  error?: string;
}
```

### 2. 时间轴工具栏

**文件**: `src/components/projects/editor/timeline/timeline-toolbar.tsx`

#### 更新内容

1. **新增导入**:
   - `JSZip` - ZIP 打包库
   - `getExportableShots` - Server Action
   - `Download` - Lucide 图标

2. **新增 Props**:
   - `onExportVideos?: () => void` - 导出回调函数
   - `isExportingVideos?: boolean` - 导出状态

3. **UI 更新**:
   在 `SelectionActionsBar` 组件的「生成视频」按钮后添加了「导出视频」按钮：
   - 绿色主题边框（与其他操作区分）
   - 显示选中的分镜数量
   - 导出中显示加载动画
   - 响应式设计（移动端优化）

### 3. 编辑器布局

**文件**: `src/components/projects/editor/editor-layout.tsx`

#### 实现的导出逻辑

```typescript
const handleExportVideos = async () => {
  // 1. 验证选择
  // 2. 获取可导出分镜
  // 3. 创建 ZIP 实例
  // 4. 逐个下载并添加到 ZIP（显示进度）
  // 5. 生成 ZIP 文件
  // 6. 触发浏览器下载
}
```

#### 功能特性

1. **进度提示**:
   - "正在准备导出..."
   - "正在打包视频 (3/5)..."
   - "已跳过 2 个未生成视频的分镜"
   - "正在生成压缩包..."
   - "成功导出 5 个视频"

2. **错误处理**:
   - 未选择分镜
   - 没有可导出的视频
   - 单个视频下载失败（跳过并继续）
   - 网络错误
   - 权限错误

3. **文件命名**:
   - ZIP 文件: `第1集-分镜视频-{timestamp}.zip`
   - 视频文件: `shot-001.mp4`, `shot-002.mp4`, ...

### 4. 时间轴容器

**文件**: `src/components/projects/editor/timeline/timeline-container.tsx`

传递 `onExportVideos` 和 `isExportingVideos` 给子组件 `TimelineToolbar`。

## 用户使用流程

1. 在编辑器时间轴中选中多个分镜（支持点击、Shift 多选、Cmd/Ctrl 多选）
2. 工具栏自动切换到选中操作栏
3. 点击「导出视频」按钮
4. 系统自动筛选有视频的分镜
5. 显示实时打包进度
6. 如有分镜被跳过，显示提示信息
7. 浏览器自动下载 ZIP 文件
8. 解压 ZIP 文件即可获得所有视频

## 技术亮点

### 1. 性能优化
- 使用 DEFLATE 压缩算法（压缩级别 6）
- 流式下载视频文件
- 及时释放内存（URL.revokeObjectURL）

### 2. 用户体验
- 实时进度反馈
- 友好的错误提示
- 自动跳过无效分镜
- 可识别的文件命名

### 3. 健壮性
- 完整的权限验证
- 单个文件失败不影响整体导出
- 详细的错误日志
- 状态管理清晰

## 依赖项

- **jszip**: `^3.10.1` - ZIP 文件创建和打包

## 边界情况处理

| 情况 | 处理方式 |
|------|---------|
| 未选择分镜 | 提示"请先选择要导出的分镜" |
| 所有分镜都没有视频 | 提示"没有可导出的视频，请先生成视频" |
| 部分分镜没有视频 | 自动跳过，提示跳过数量 |
| 单个视频下载失败 | 显示警告，继续下载其他视频 |
| 网络错误 | 显示错误信息，停止导出 |
| 无权限访问项目 | 返回权限错误 |

## 测试建议

1. **功能测试**:
   - 导出单个视频
   - 导出多个视频（3-10 个）
   - 导出混合状态（部分有视频，部分无视频）
   - 导出全部无视频的分镜

2. **性能测试**:
   - 导出大量视频（20+ 个）
   - 导出大文件视频（>100MB）
   - 并发导出（同时打开多个项目）

3. **UI 测试**:
   - 桌面端布局
   - 移动端布局
   - 不同浏览器（Chrome, Safari, Firefox）
   - 进度提示显示正确

4. **错误测试**:
   - 网络断开中途
   - 文件 URL 失效
   - 存储空间不足
   - 权限被撤销

## 后续优化建议

1. **功能增强**:
   - 支持自定义文件命名格式
   - 支持选择压缩级别
   - 支持暂停/恢复下载
   - 支持导出为其他格式（如合并为单个视频）

2. **性能优化**:
   - 使用 Web Worker 处理压缩
   - 并发下载多个视频
   - 显示下载速度和剩余时间

3. **用户体验**:
   - 添加导出历史记录
   - 支持预览 ZIP 内容
   - 导出完成后自动打开文件夹

## 相关文档

- [分镜视频生成功能](./shot-video-generation-feature.md)
- [时间轴操作指南](./timeline-operations.md)
- [任务系统快速开始](./TASK_SYSTEM_QUICK_START.md)

