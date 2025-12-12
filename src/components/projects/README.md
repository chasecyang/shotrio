# Projects 组件目录结构

## 📁 目录说明

### `characters/` - 角色管理相关
- `character-dialog.tsx` - 角色创建/编辑对话框
- `character-extraction-dialog.tsx` - AI角色提取对话框
- `character-image-display.tsx` - 角色图片展示
- `chip-nav.tsx` - 角色导航标签
- `image-preview-dialog.tsx` - 图片预览对话框

### `scenes/` - 场景管理相关
- 场景列表、创建、编辑等相关组件

### `editor/` - 编辑器相关（主要工作区）
- `editor-context.tsx` - 编辑器状态管理
- `editor-layout.tsx` - 编辑器布局
- `preview-panel/` - 预览面板
- `resource-panel/` - 资源面板（包含剧集、角色、场景列表）
- `timeline/` - 时间轴
- 集成了剧本编辑、分镜管理、视频预览等功能

### `settings/` - 设置相关
- `project-settings-form.tsx` - 项目设置表单
- `style-selector.tsx` - 风格选择器

### `layout/` - 布局组件
- `project-selector.tsx` - 项目选择器
- `project-sidebar.tsx` - 项目侧边栏
- `background-tasks.tsx` - 后台任务管理

### `shared/` - 共享组件
- 跨模块使用的通用组件

## 🗑️ 已删除的冗余组件
- `storyboard/` 目录 - 旧版独立分镜页面，功能已集成到编辑器中
- `production/` 目录 - 旧版成片页面，功能已集成到编辑器中
- `shot-card.tsx` (根目录) - 旧版分镜卡片
- `shots-section.tsx` - 旧版分镜管理
- `image-generation-panel.tsx` - 未使用的图像生成面板
- `scripts/` 目录 - 旧版剧本管理页面，已集成到编辑器中

## 📝 更新记录
- 2024-12-12: 删除旧版成片页面和相关组件，所有功能已整合到编辑器中
- 2024-12-12: 删除独立的分镜页面，功能已完全集成到编辑器中
- 2024-12-12: 删除独立的剧本页面，功能已集成到编辑器中
- 2024-12-07: 重新组织目录结构，按功能分类组件
