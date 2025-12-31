# Project Actions

项目相关的 server actions，按功能模块拆分。

## 文件结构

```
project/
├── base.ts       # 项目基础 CRUD 操作
├── episode.ts    # 剧集管理操作
├── refresh.ts    # 数据刷新操作
├── index.ts      # 统一导出
└── README.md     # 说明文档
```

## 模块说明

### base.ts - 项目基础操作
- `createProject` - 创建新项目
- `getUserProjects` - 获取用户所有项目（带统计）
- `getProjectDetail` - 获取项目详情
- `updateProject` - 更新项目信息
- `deleteProject` - 删除项目

### episode.ts - 剧集操作
- `createEpisode` - 创建剧集
- `updateEpisode` - 更新剧集
- `deleteEpisode` - 删除剧集并重新编号

### refresh.ts - 数据刷新操作
- `refreshVideo` - 刷新单个视频数据
- `refreshProjectVideos` - 刷新项目的所有视频
- `refreshProject` - 刷新整个项目数据

## 使用方式

```typescript
// 从统一入口导入
import { createProject, getUserProjects } from "@/lib/actions/project";

// 或从具体模块导入
import { createEpisode } from "@/lib/actions/project/episode";
```

## 架构变更说明

### 已移除的概念
- **分镜（Shot/Storyboard）** - 已完全移除，改为直接使用视频片段（Video）
  - 原因：AI 成片中，分镜组织的短片不可用，可用的短片是视频片段剪辑而成的
  - Agent 可以直接获取视频 prompt，了解视频内容和剪辑方式，流程更流畅

### 新的工作流
1. Agent 直接生成视频片段（Video）
2. 视频片段包含完整的 prompt 描述
3. 通过视频片段进行剪辑和组织

## 已删除的冗余代码

以下 actions 已从原 `project-actions.ts` 中删除：

1. **insertEpisodeAfter** - 未被使用
2. **reorderEpisodes** - 未被使用
3. **createCharacter** - 已迁移到 `@/lib/actions/character`
4. **updateCharacter** - 已迁移到 `@/lib/actions/character`
5. **deleteCharacter** - 已迁移到 `@/lib/actions/character`
6. **shot.ts 全部内容** - 分镜概念已移除

## 注意事项

- 所有 actions 都需要用户登录认证
- 使用 `revalidatePath` 确保缓存更新
- 删除操作会自动重新整理编号，保持数据连续性
