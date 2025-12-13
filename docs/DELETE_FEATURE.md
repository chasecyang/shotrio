# 角色和场景删除功能

## 功能概述

为角色模块和场景模块添加了删除功能，用户可以在详情页面删除不需要的角色或场景。

## 实现详情

### 后端实现

#### 角色删除
- **文件**: `src/lib/actions/character/crud.ts`
- **方法**: `deleteCharacter(projectId: string, characterId: string)`
- **权限验证**: 验证用户是否拥有该项目
- **级联删除**: 数据库设置了级联删除，删除角色时会自动删除：
  - 所有关联的角色图片 (`character_image`)
  - 相关的 `shot_character` 关联记录

#### 场景删除
- **文件**: `src/lib/actions/scene/crud.ts`
- **方法**: `deleteScene(projectId: string, sceneId: string)`
- **权限验证**: 验证用户是否拥有该项目
- **级联删除**: 数据库设置了级联删除，删除场景时会自动删除：
  - 所有关联的场景图片 (`scene_image`)
  - 包括全景布局图和叙事视角图

### 前端实现

#### 角色详情页
- **文件**: `src/components/projects/editor/preview-panel/character-detail.tsx`
- **UI位置**: 右上角删除按钮（垃圾桶图标）
- **确认对话框**: 使用 `AlertDialog` 组件进行二次确认
- **删除后操作**:
  1. 清除选中状态
  2. 刷新项目数据
  3. 显示成功提示

#### 场景详情页
- **文件**: `src/components/projects/editor/preview-panel/scene-detail.tsx`
- **UI位置**: 右上角删除按钮（垃圾桶图标）
- **确认对话框**: 使用 `AlertDialog` 组件进行二次确认
- **删除后操作**:
  1. 清除选中状态
  2. 刷新项目数据
  3. 显示成功提示

## 数据库级联删除

在 `src/lib/db/schemas/project.ts` 中已配置好级联删除：

```typescript
// 角色图片表
export const characterImage = pgTable("character_image", {
  characterId: text("character_id")
    .notNull()
    .references(() => character.id, { onDelete: "cascade" }), // 级联删除
  // ...
});

// 场景图片表
export const sceneImage = pgTable("scene_image", {
  sceneId: text("scene_id")
    .notNull()
    .references(() => scene.id, { onDelete: "cascade" }), // 级联删除
  // ...
});
```

## 使用说明

### 删除角色
1. 在项目编辑器中，从资源面板选择要删除的角色
2. 在角色详情页面，点击右上角的删除按钮
3. 在确认对话框中点击"确认删除"
4. 系统会删除该角色及其所有造型图片

### 删除场景
1. 在项目编辑器中，从资源面板选择要删除的场景
2. 在场景详情页面，点击右上角的删除按钮
3. 在确认对话框中点击"确认删除"
4. 系统会删除该场景及其所有视角图片

## 安全性

- ✅ 用户权限验证：只有项目所有者可以删除角色/场景
- ✅ 二次确认：防止误删除
- ✅ 事务处理：确保数据一致性
- ✅ 级联删除：自动清理相关数据
- ✅ 错误处理：失败时显示友好的错误提示

## 注意事项

1. **删除操作不可撤销**：删除后无法恢复，请谨慎操作
2. **关联数据**：删除角色/场景会同时删除所有关联的图片
3. **镜头引用**：如果有镜头引用了被删除的角色或场景，相关引用会被设置为 null（通过 `onDelete: "set null"` 配置）

## 相关文件

### 后端
- `src/lib/actions/character/crud.ts` - 角色CRUD操作
- `src/lib/actions/scene/crud.ts` - 场景CRUD操作
- `src/lib/db/schemas/project.ts` - 数据库表结构定义

### 前端
- `src/components/projects/editor/preview-panel/character-detail.tsx` - 角色详情页
- `src/components/projects/editor/preview-panel/scene-detail.tsx` - 场景详情页
- `src/components/ui/alert-dialog.tsx` - 确认对话框组件

## 未来改进

- [ ] 添加"软删除"功能，支持恢复已删除的角色/场景
- [ ] 批量删除功能
- [ ] 删除前检查依赖关系并提示用户
- [ ] 添加删除历史记录

