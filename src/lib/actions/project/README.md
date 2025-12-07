# Project Actions

项目相关的 server actions，按功能模块拆分。

## 文件结构

```
project/
├── base.ts       # 项目基础 CRUD 操作
├── episode.ts    # 剧集管理操作
├── shot.ts       # 分镜管理操作
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

### shot.ts - 分镜操作
- `getEpisodeShots` - 获取剧集的所有分镜
- `createShot` - 创建分镜
- `updateShot` - 更新分镜
- `deleteShot` - 删除分镜并重新编号
- `reorderShots` - 批量更新分镜顺序

## 使用方式

```typescript
// 从统一入口导入
import { createProject, getUserProjects } from "@/lib/actions/project";

// 或从具体模块导入
import { createEpisode } from "@/lib/actions/project/episode";
```

## 已删除的冗余代码

以下 actions 已从原 `project-actions.ts` 中删除：

1. **insertEpisodeAfter** - 未被使用
2. **reorderEpisodes** - 未被使用
3. **createCharacter** - 已迁移到 `@/lib/actions/character`
4. **updateCharacter** - 已迁移到 `@/lib/actions/character`
5. **deleteCharacter** - 已迁移到 `@/lib/actions/character`

## 注意事项

- 所有 actions 都需要用户登录认证
- 使用 `revalidatePath` 确保缓存更新
- 删除操作会自动重新整理编号，保持数据连续性
