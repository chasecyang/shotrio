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
- `agent-panel/` - AI助手面板
- `asset-gallery-panel.tsx` - 素材画廊面板（中央素材展示区）
- `shared/` - 共享组件（素材卡片、上传对话框等）
- 集成了素材管理、视频生成等功能

### `settings/` - 设置相关
- `project-settings-form.tsx` - 项目设置表单（在编辑器预览区中使用）
- `style-selector.tsx` - 风格选择器

### `layout/` - 布局组件
- `project-selector.tsx` - 项目选择器（集成在编辑器 Header 中）

### `shared/` - 共享组件
- 跨模块使用的通用组件

## 🗑️ 已删除的冗余组件
- `storyboard/` 目录 - 旧版独立分镜页面，分镜概念已完全移除
- `production/` 目录 - 旧版成片页面，功能已集成到编辑器中
- `shot-card.tsx` (根目录) - 旧版分镜卡片，分镜概念已移除
- `shots-section.tsx` - 旧版分镜管理，分镜概念已移除
- `timeline/` 目录 - 时间轴组件，随分镜概念移除
- `image-generation-panel.tsx` - 未使用的图像生成面板
- `project-sidebar.tsx` - 项目侧边栏，功能已整合到编辑器 Header 中
- `project-header.tsx` - 项目头部，不再需要
- `app/[lang]/projects/[id]/settings/page.tsx` - 独立设置页面，已整合到编辑器预览区
- `resource-panel/` 目录 - 旧版资源面板（带Tab切换），已移除，改用 AssetGalleryPanel

## 📝 更新记录
- 2024-12-31: **优化素材库** - 移除旧版 ResourcePanel（带Tab切换），统一使用 AssetGalleryPanel。添加素材多选和底部悬浮操作栏功能。
- 2024-12-31: **移除分镜概念** - 分镜/Shot/Storyboard概念已完全移除，改为直接使用视频片段（Video）。Agent直接生成视频片段，通过视频片段进行剪辑和组织，流程更流畅。
- 2024-12-21: 整合设置页面到编辑器预览区，通过 URL 参数 (?view=settings) 控制显示
- 2024-12-21: 移除 Sidebar，所有功能整合到编辑器 Header（Logo、项目切换、用户菜单）
- 2024-12-12: 删除旧版成片页面和相关组件，所有功能已整合到编辑器中
- 2024-12-12: 删除独立的分镜页面，功能已完全集成到编辑器中
- 2024-12-07: 重新组织目录结构，按功能分类组件
