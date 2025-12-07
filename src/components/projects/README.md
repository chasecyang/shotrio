# Projects 组件目录结构

## 📁 目录说明

### `characters/` - 角色管理相关
- `character-dialog.tsx` - 角色创建/编辑对话框
- `character-detail-sheet.tsx` - 角色详情侧边栏
- `character-extraction-dialog.tsx` - AI角色提取对话框
- `character-settings-tab.tsx` - 角色设置标签页
- `characters-section.tsx` - 角色管理主页面
- `image-preview-dialog.tsx` - 图片预览对话框

### `storyboard/` - 分镜板相关
- `episode-selector.tsx` - 剧集选择器
- `shot-card.tsx` - 分镜卡片组件
- `shot-grid.tsx` - 分镜网格视图
- `storyboard-section.tsx` - 分镜板主页面

### `scripts/` - 剧本管理相关
- `novel-import-dialog.tsx` - 小说导入对话框
- `scripts-section.tsx` - 剧本管理主页面

### `settings/` - 设置相关
- `project-settings-form.tsx` - 项目设置表单

### `layout/` - 布局组件
- `project-selector.tsx` - 项目选择器
- `project-sidebar.tsx` - 项目侧边栏

## 🗑️ 已删除的冗余组件
- `shot-card.tsx` (根目录) - 旧版分镜卡片，已被 `storyboard/shot-card.tsx` 替代
- `shots-section.tsx` - 旧版分镜管理，已被 `storyboard-section.tsx` 替代
- `image-generation-panel.tsx` - 未使用的图像生成面板

## 📝 更新记录
- 2024-12-07: 重新组织目录结构，按功能分类组件
- 删除了3个冗余组件
- 更新了所有相关的导入路径
