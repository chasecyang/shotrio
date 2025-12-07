# Character Actions 重构说明

## 文件结构

原先所有角色相关的 actions 都在 `character-actions.ts` (807行) 中，现已拆分为：

```
character/
├── index.ts              # 统一导出入口
├── crud.ts               # 角色的增删改查操作
├── image.ts              # 角色图片相关操作
└── extraction.ts         # 角色提取和导入操作
```

## 各模块说明

### crud.ts (107行)
基础的角色 CRUD 操作：
- `upsertCharacter` - 创建或更新角色
- `deleteCharacter` - 删除角色

### image.ts (334行)
角色图片管理：
- `generateCharacterImages` - 生成角色图片（调用 AI）
- `generateImageForCharacterStyle` - 为单个造型生成图片（异步任务）
- `regenerateCharacterStyleImage` - 重新生成造型图片（异步任务）
- `saveCharacterImage` - 保存角色图片状态
- `deleteCharacterImage` - 删除角色图片
- `setCharacterPrimaryImage` - 设置主图

### extraction.ts (238行)
从剧本中提取角色：
- `extractCharactersFromScript` - 从剧本提取角色信息（同步版本）
- `importExtractedCharacters` - 批量导入提取的角色

### index.ts
统一导出所有 actions，保持向后兼容：
```typescript
export { upsertCharacter, deleteCharacter } from "./crud";
export { generateCharacterImages, ... } from "./image";
export { extractCharactersFromScript, ... } from "./extraction";
```

## 删除的冗余代码

- ❌ `extractCharactersFromScriptAsync` - 异步版本的角色提取函数，从未被使用

## 迁移说明

所有引用已自动更新，只需将：
```typescript
import { xxx } from "@/lib/actions/character-actions";
```

改为：
```typescript
import { xxx } from "@/lib/actions/character";
```

## 已更新的文件

- ✅ `src/components/projects/characters/characters-section.tsx`
- ✅ `src/components/projects/characters/character-detail-sheet.tsx`
- ✅ `src/components/projects/characters/character-extraction-dialog.tsx`
- ✅ `src/components/projects/characters/character-dialog.tsx`
- ✅ `src/components/projects/characters/character-settings-tab.tsx`

## 优势

1. **更好的组织性** - 按功能模块拆分，易于维护
2. **更快的构建速度** - 模块化后，只需重新编译修改的部分
3. **更清晰的职责** - 每个文件专注于特定功能
4. **更易于测试** - 可以针对单个模块编写测试
5. **删除冗余代码** - 移除了未使用的 `extractCharactersFromScriptAsync`
