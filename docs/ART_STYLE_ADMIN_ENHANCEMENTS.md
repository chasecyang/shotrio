# 美术风格管理后台增强功能

## 更新日期
2024-12-10

## 功能概述
为管理后台的美术风格管理页面添加了 Prompt 显示和大图查看功能。

## 实现的功能

### 1. 表格增强
- ✅ **新增 Prompt 列**：在表格中直接显示每个风格的 Prompt（使用等宽字体，最多显示 2 行）
- ✅ **预览图可点击**：鼠标悬停在预览图上时显示放大镜图标，点击可查看大图
- ✅ **新增"查看详情"操作**：在操作下拉菜单中添加"查看详情"选项

### 2. 大图查看功能
**预览图大图对话框**：
- 点击表格中的预览图缩略图可打开大图对话框
- 最大宽度 4xl，图片最高 70vh，保持原始比例
- 显示风格名称作为标题

**查看详情对话框**：
- 显示完整的风格信息
- 预览图（如果有）可点击查看大图
- 显示中英文名称
- 显示描述
- **完整的 Prompt 显示**：使用代码块样式（灰色背景，等宽字体，支持换行）
- 显示所有标签
- 显示类型（系统预设/用户自定义）和使用次数

### 3. 编辑对话框增强
- ✅ **显示当前预览图**：在编辑时显示现有的预览图
- ✅ **预览图可点击**：点击预览图可查看大图
- ✅ **Prompt 字段使用等宽字体**：便于查看和编辑

## 技术实现

### 修改的文件

#### 1. `/src/components/admin/art-styles/style-table.tsx`
**新增状态**：
```typescript
const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);
const [viewingStyle, setViewingStyle] = useState<ArtStyle | null>(null);
```

**新增功能**：
- 表格添加 Prompt 列，使用 `font-mono` 和 `line-clamp-2`
- 预览图添加 hover 效果和点击事件
- 新增"查看详情"菜单项
- 两个新的对话框组件（查看大图、查看详情）

#### 2. `/src/components/admin/art-styles/style-edit-dialog.tsx`
**新增状态**：
```typescript
const [viewingImage, setViewingImage] = useState<string | null>(null);
```

**新增功能**：
- 在表单顶部显示当前预览图（如果存在）
- 预览图可点击查看大图
- Prompt textarea 添加 `font-mono` 样式
- 新增大图查看对话框

## UI/UX 改进

### 视觉效果
- **等宽字体**：Prompt 使用等宽字体显示，更易读
- **Hover 效果**：预览图悬停时显示半透明黑色遮罩和放大镜图标
- **过渡动画**：使用 `transition-opacity` 实现平滑的悬停效果
- **代码块样式**：查看详情对话框中的 Prompt 使用灰色背景的代码块样式

### 交互优化
- **点击预览图查看大图**：直观的交互方式
- **查看详情对话框**：集中展示所有信息，包括完整的 Prompt
- **响应式设计**：表格可横向滚动，适配不同屏幕尺寸

## 使用说明

### 查看 Prompt
1. 在表格的 Prompt 列可以看到每个风格的 Prompt 预览（最多 2 行）
2. 点击操作菜单的"查看详情"可查看完整的 Prompt

### 查看大图
1. **方式一**：点击表格中的预览图缩略图
2. **方式二**：点击"查看详情"，然后点击详情对话框中的预览图
3. **方式三**：在编辑对话框中点击当前预览图

### 编辑风格
1. 点击操作菜单的"编辑"
2. 如果风格有预览图，会在表单顶部显示
3. 点击预览图可查看大图
4. Prompt 字段使用等宽字体，便于编辑

## 注意事项
- 表格使用 `overflow-x-auto` 支持横向滚动
- 所有图片使用 `object-contain` 保持原始比例
- 大图对话框最大高度为 70vh，避免超出屏幕
- 使用 lucide-react 的 `ZoomIn` 和 `Eye` 图标

## 统一主体生成预览图

### 实现思路
为了让用户更清楚地看到不同风格之间的区别，在生成预览图时使用统一的主体。这样所有风格的预览图都是同一个主体在不同风格下的呈现，对比效果更明显。

### 统一主体
使用人物肖像作为统一主体（最能体现风格差异）：
```
"a young woman with long flowing hair, beautiful portrait, detailed face, elegant pose"
```

### Prompt 构成
生成预览图时的完整 prompt 结构：
```
{统一主体} + {风格prompt} + "masterpiece, high quality, professional artwork"
```

**示例**：
```
"a young woman with long flowing hair, beautiful portrait, detailed face, elegant pose, [风格prompt], masterpiece, high quality, professional artwork"
```

### 优点
1. ✅ **对比性强**：同一主体在不同风格下的表现更容易对比
2. ✅ **风格特征明显**：人物肖像最能体现色彩、线条、细节等风格特征
3. ✅ **简洁明了**：统一使用一种主体，避免复杂性

## 后续优化建议
1. 添加 Prompt 复制按钮
2. 支持在查看详情对话框中直接编辑
3. 添加预览图的下载功能
4. 支持批量操作（批量生成预览图）

