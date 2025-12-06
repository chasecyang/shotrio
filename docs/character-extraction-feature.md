# 角色提取功能实现文档

## 功能概述

从剧本自动提取角色信息和造型描述的完整功能，包括AI分析、预览编辑、智能导入和高亮反馈。

## 实现的功能

### 1. AI角色提取 (Server Actions)

**文件**: `src/lib/actions/character-actions.ts`

#### `extractCharactersFromScript(projectId)`
- 分析项目中所有剧集的剧本内容
- 使用OpenAI GPT模型提取角色信息
- 返回角色列表，包含：
  - 角色名称
  - 性格描述
  - 基础外貌（固定特征）
  - 多个造型描述（label + 英文prompt）

**AI Prompt设计要点**:
- 识别主要角色（至少出现2次）
- 提取固定特征（发色、瞳色、体型等）
- 分析造型变化（服装、配饰、妆容、情绪）
- 生成专业的英文图像生成prompt
- 返回结构化JSON数据

#### `importExtractedCharacters(projectId, characters)`
- 批量导入提取的角色
- 智能合并逻辑：
  - 已存在角色：保留基本信息，只添加新造型（通过label去重）
  - 新角色：创建完整记录
- 返回导入统计（新增角色数、新增造型数、更新角色数）

### 2. 提取对话框组件

**文件**: `src/components/projects/character-extraction-dialog.tsx`

#### 多步骤流程

**步骤1: 提取中 (extracting)**
- 显示加载动画和提示
- 自动调用提取API
- 错误处理和重试功能

**步骤2: 预览编辑 (preview)**
- 左侧角色列表：
  - 显示所有提取的角色
  - 标注状态（新角色/已存在）
  - 支持多选/全选
  - 显示造型数量
- 右侧详情编辑：
  - 编辑角色基本信息（名称、性格、外貌）
  - 管理造型列表（添加、编辑、删除）
  - 实时预览造型prompt
- 底部操作栏：
  - 显示选择统计
  - 全选/取消全选
  - 确认导入按钮

**步骤3: 导入中 (importing)**
- 显示导入进度

**步骤4: 成功反馈 (success)**
- 显示导入统计数据
- 3秒后自动跳转到角色管理页面

#### 交互特性
- 支持inline编辑所有字段
- 实时保存编辑状态
- 键盘快捷键支持（计划中）
- 响应式布局（移动端/PC端）

### 3. 入口集成

**文件**: `src/components/projects/scripts-section.tsx`

- 在剧本管理页面顶部添加"提取角色"按钮
- 使用渐变背景和图标组合，突出AI功能
- 位置：导入小说按钮左侧
- 条件：项目有剧集时显示

### 4. 成功反馈和高亮

**文件**: `src/components/projects/characters-section.tsx`

#### 高亮显示逻辑
- 通过URL参数 `?fromExtraction=true` 触发
- 识别最近5分钟内更新的角色
- 添加视觉效果：
  - 边框高亮（primary色）
  - 阴影效果
  - 动画进入效果
  - "新导入"徽章（带Sparkles图标）
- 3秒后自动移除高亮

### 5. 类型定义

**文件**: `src/types/project.ts`

新增类型：
- `ExtractedCharacterStyle`: 造型描述
- `ExtractedCharacter`: 提取的角色数据
- `CharacterExtractionResult`: AI提取结果
- `CharacterToImport`: 待导入角色（含选择状态）

## 技术栈

- **AI服务**: OpenAI GPT (通过 `openai.service.ts`)
- **数据库**: PostgreSQL + Drizzle ORM
- **UI组件**: shadcn/ui
- **状态管理**: React useState + useEffect
- **路由**: Next.js App Router
- **动画**: Tailwind CSS animations

## 使用流程

1. 用户在剧本管理页面点击"提取角色"按钮
2. AI自动分析所有剧集内容，提取角色信息
3. 在预览界面查看和编辑提取结果
4. 选择要导入的角色，点击"确认导入"
5. 系统智能合并数据，避免重复
6. 自动跳转到角色管理页面，高亮显示新导入的角色
7. 用户可以进一步为每个造型生成图片

## 数据流

```
剧本内容 (scriptContent)
    ↓
AI提取 (extractCharactersFromScript)
    ↓
预览编辑 (CharacterExtractionDialog)
    ↓
智能导入 (importExtractedCharacters)
    ↓
角色管理页面 (CharactersSection) + 高亮显示
```

## 智能合并策略

### 角色匹配
- 通过名称模糊匹配（忽略大小写和空格）
- 已存在角色：更新描述（如果新描述更详细）
- 新角色：直接创建

### 造型去重
- 通过label匹配（忽略大小写和空格）
- 只添加不存在的造型
- 保留原有造型不变

## 错误处理

- API调用失败：显示错误信息和重试按钮
- 无法提取角色：提示剧本内容不足
- 部分导入失败：显示详细错误，成功的仍然导入
- 网络超时：自动重试机制（计划中）

## 性能优化

- 使用Suspense和骨架屏优化加载体验
- 批量数据库操作（事务处理）
- 组件懒加载
- 防抖和节流（计划中）

## 后续扩展

- [ ] 支持从单个剧集提取
- [ ] 造型自动分类（日常/正式/特殊场景）
- [ ] 角色关系图谱可视化
- [ ] 批量生成所有造型图片的队列管理
- [ ] 导出/导入角色库
- [ ] 角色模板市场

## 相关文件

### 核心文件
- `src/lib/actions/character-actions.ts` - Server Actions
- `src/components/projects/character-extraction-dialog.tsx` - 提取对话框
- `src/components/projects/characters-section.tsx` - 角色管理页面
- `src/components/projects/scripts-section.tsx` - 剧本页面（入口）
- `src/types/project.ts` - 类型定义

### 依赖文件
- `src/lib/services/openai.service.ts` - OpenAI API封装
- `src/lib/db/schemas/project.ts` - 数据库Schema
- `src/components/ui/*` - UI组件库

## 测试建议

1. **功能测试**
   - 创建包含多个角色的剧本
   - 测试提取功能
   - 验证角色信息准确性
   - 测试编辑功能
   - 验证导入结果

2. **边界测试**
   - 空剧本
   - 单个角色
   - 大量角色（>20个）
   - 重复角色名称
   - 特殊字符处理

3. **性能测试**
   - 大量剧集（>50集）
   - 长剧本内容（>10000字）
   - 并发提取请求

4. **UI测试**
   - 移动端适配
   - 不同屏幕尺寸
   - 暗色模式
   - 动画流畅度

## 已知限制

- AI提取准确度依赖剧本质量
- 单次提取token限制（约6000 tokens）
- 需要OpenAI API配置
- 网络延迟影响用户体验

## 配置要求

### 环境变量
```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1 (可选)
OPENAI_MODEL=gpt-3.5-turbo (可选)
```

### 数据库
- 已有的character和characterImage表结构
- 支持事务操作

## 更新日志

### v1.0.0 (2024-12-06)
- ✅ 实现AI角色提取功能
- ✅ 创建多步骤提取对话框
- ✅ 实现智能导入和合并逻辑
- ✅ 添加成功反馈和高亮显示
- ✅ 集成到剧本管理页面

