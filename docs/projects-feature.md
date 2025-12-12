# 项目管理功能说明

## 功能概述

项目管理功能让用户可以将小说文本转化为短剧分集大纲，是 Cineqo 从文字到视频的第一步。

## 核心流程

```
小说文本 → 分集大纲 → 分镜脚本 → AI 生成视频
```

## 功能特性

### 1. 项目管理
- ✅ 创建项目
- ✅ 查看项目列表（带统计数据）
- ✅ 项目详情页
- ✅ 更新项目信息
- ✅ 删除项目

### 2. 小说内容管理
- ✅ 添加/编辑小说文本
- ✅ 实时字数统计
- ✅ 内容预览
- ✅ 支持长文本（建议 5000-50000 字）

### 3. AI 生成分集大纲
- ✅ 根据小说内容自动生成分集
- ✅ 自定义生成集数（1-100 集）
- ✅ 每集包含：
  - 标题
  - 梗概
  - 钩子设计（结尾悬念）
- ✅ 重新生成功能

### 4. 角色管理（预留）
- 角色信息管理
- 角色外观描述
- AI 提示词生成
- 用于保持角色一致性

## 使用步骤

### 步骤 1：创建项目
1. 访问 `/projects` 页面
2. 点击「创建项目」按钮
3. 填写项目名称和简介
4. 提交创建

### 步骤 2：添加小说内容
1. 进入项目详情页
2. 在「小说内容」标签页
3. 粘贴或输入小说文本
4. 点击「保存内容」

### 步骤 3：生成分集大纲
1. 切换到「分集大纲」标签页
2. 设置要生成的集数（建议 10-20 集）
3. 点击「开始生成」
4. 等待 AI 处理（约 30-60 秒）
5. 查看生成的分集大纲

### 步骤 4：查看和编辑
- 查看每一集的标题、梗概和钩子
- 如需调整，可重新生成
- 后续可基于大纲进一步细化分镜

## AI 生成逻辑

### Prompt 设计
系统会向 AI 提供以下指令：

1. **短剧特点**：
   - 每集 1-2 分钟
   - 快节奏
   - 强钩子设计

2. **要求**：
   - 删减支线剧情
   - 突出主线冲突
   - 前三集必须抓人
   - 每集结尾留悬念

3. **输出格式**：
   - JSON 格式
   - 包含标题、梗概、钩子

### 生成质量优化建议

1. **小说长度**：5000-50000 字最佳
2. **内容质量**：情节完整、冲突明确
3. **集数设置**：
   - 短篇：10-20 集
   - 中篇：20-50 集
   - 长篇：50-100 集

## 数据结构

### Project（项目）
```typescript
{
  id: string;
  userId: string;
  title: string;
  description?: string;
  originalContent?: string;  // 小说文本
  stylePrompt?: string;      // 全局风格
  status: 'draft' | 'generating' | 'completed' | 'archived';
}
```

### Episode（剧集）
```typescript
{
  id: string;
  projectId: string;
  title: string;
  summary?: string;          // 梗概 + 钩子
  scriptContent?: string;    // 完整剧本（后续功能）
  order: number;             // 集数序号
}
```

### Character（角色）
```typescript
{
  id: string;
  projectId: string;
  name: string;
  description?: string;      // 角色小传
  appearance?: string;       // 外貌描述
  imagePrompt?: string;      // AI 生成提示词
  avatarUrl?: string;        // 定妆照
  seed?: number;             // 固定种子
}
```

## API 接口

### Server Actions

#### 项目相关
- `createProject(data)` - 创建项目
- `getUserProjects()` - 获取用户项目列表
- `getProjectDetail(projectId)` - 获取项目详情
- `updateProject(projectId, data)` - 更新项目
- `deleteProject(projectId)` - 删除项目

#### AI 生成
- `generateEpisodes(projectId, targetEpisodeCount)` - 生成分集大纲

#### 剧集管理
- `createEpisode(data)` - 创建剧集
- `updateEpisode(episodeId, data)` - 更新剧集
- `deleteEpisode(episodeId)` - 删除剧集

#### 角色管理
- `createCharacter(data)` - 创建角色
- `updateCharacter(characterId, data)` - 更新角色
- `deleteCharacter(characterId)` - 删除角色

## 后续规划

### Phase 2: 分镜生成
- [ ] 将分集大纲转化为详细分镜
- [ ] 支持手动添加/编辑分镜
- [ ] 分镜画面描述（中文 + 英文 Prompt）
- [ ] 景别、运镜、台词管理

### Phase 3: 视频生成
- [ ] 基于分镜生成静态图
- [ ] 图片转视频
- [ ] TTS 语音合成
- [ ] 视频剪辑与合成

### Phase 4: 协作与导出
- [ ] 项目分享
- [ ] 团队协作
- [ ] 导出分镜脚本（PDF）
- [ ] 导出最终视频

## 环境配置

### 必需的环境变量
```env
DATABASE_URL=your_postgres_connection_string
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选
```

### 数据库迁移
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

## 技术栈

- **前端框架**: Next.js 15 + React 19
- **样式**: Tailwind CSS + shadcn/ui
- **数据库**: PostgreSQL + Drizzle ORM
- **AI 服务**: OpenAI (gpt-4o-mini)
- **国际化**: next-intl
- **类型安全**: TypeScript

## 性能优化

1. **Suspense 边界**：异步组件独立加载
2. **Server Components**：减少客户端 JS
3. **数据预加载**：parallel data fetching
4. **关系查询优化**：with 语法减少数据库查询

## 注意事项

1. **权限控制**：所有操作都会验证用户登录状态
2. **数据安全**：项目数据与用户 ID 强绑定
3. **错误处理**：所有 Server Action 都有 try-catch
4. **用户体验**：
   - Loading 状态提示
   - Toast 消息反馈
   - 表单验证
   - 空状态设计













