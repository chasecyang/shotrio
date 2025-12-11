# 分镜多角色多对话功能实施总结

## 实施日期
2025年

## 概述
成功将分镜（Shot）功能从"单角色单对话"模式升级为"多角色多对话"模式，一个镜头现在可以包含多个角色，并支持按顺序的多段对话。

## 已完成的工作

### 1. 数据库Schema修改 ✅

#### 修改了 `shot` 表
- ❌ 移除 `dialogue` 字段（台词）
- ❌ 移除 `mainCharacterId` 字段（主角色关联）
- ✅ 将 `audioUrl` 重命名为 `finalAudioUrl`（存储混音后的完整音频）

#### 新增 `shot_character` 表
记录镜头中出现的角色，支持多对多关系：
- `id` - 主键
- `shotId` - 关联shot（级联删除）
- `characterId` - 关联character（级联删除）
- `characterImageId` - 角色使用的造型（可选）
- `position` - 角色在画面中的位置（左、中、右、前景、背景）
- `order` - 显示顺序
- `createdAt` - 创建时间

#### 新增 `shot_dialogue` 表
记录镜头中的对话序列，支持多段对话：
- `id` - 主键
- `shotId` - 关联shot（级联删除）
- `characterId` - 说话人（可为null表示旁白）
- `dialogueText` - 对话内容
- `order` - 说话顺序
- `startTime` - 相对时间轴位置（可选）
- `duration` - 对话时长（可选）
- `emotionTag` - 情绪标签（neutral/happy/sad/angry/surprised/fearful/disgusted）
- `audioUrl` - TTS生成的单句音频
- `createdAt` / `updatedAt` - 时间戳

#### 更新关系定义
- `shotRelations` 新增 `shotCharacters` 和 `dialogues` 关联
- 新增 `shotCharacterRelations` 和 `shotDialogueRelations`

### 2. 类型定义更新 ✅

#### 新增基础类型（`src/types/project.ts`）
```typescript
export type ShotCharacter = typeof shotCharacter.$inferSelect;
export type NewShotCharacter = typeof shotCharacter.$inferInsert;
export type ShotDialogue = typeof shotDialogue.$inferSelect;
export type NewShotDialogue = typeof shotDialogue.$inferInsert;
```

#### 更新业务类型
```typescript
export interface ShotDetail extends Shot {
  shotCharacters: (ShotCharacter & {
    character: Character;
    characterImage?: CharacterImage | null;
  })[];
  dialogues: ShotDialogue[];
  scene?: Scene | null;
}

export type EmotionTag = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'fearful' | 'disgusted';
export type CharacterPosition = 'left' | 'center' | 'right' | 'foreground' | 'background';
```

### 3. Server Actions 实现 ✅

#### 更新了查询逻辑（`src/lib/actions/project/shot.ts`）
- `getEpisodeShots()` - 包含 shotCharacters 和 dialogues 的嵌套查询
- `createShot()` - 移除 dialogue 和 mainCharacterId 参数

#### 角色管理 Actions
- `addCharacterToShot()` - 添加角色到镜头
- `removeCharacterFromShot()` - 从镜头移除角色
- `updateShotCharacter()` - 更新镜头中的角色信息

#### 对话管理 Actions
- `addDialogueToShot()` - 添加对话到镜头
- `updateShotDialogue()` - 更新对话内容
- `deleteShotDialogue()` - 删除对话
- `reorderShotDialogues()` - 重排对话顺序

### 4. UI组件开发 ✅

#### 新增组件

**CharacterSelectorDialog** (`character-selector-dialog.tsx`)
- 从项目角色列表中选择角色
- 选择角色的造型（characterImage）
- 设置角色在镜头中的位置
- 支持头像预览和造型展示

**DialogueEditor** (`dialogue-editor.tsx`)
- 内联编辑对话文本
- 选择说话人（支持旁白/空选）
- 情绪标签选择器（7种情绪，带emoji）
- 音频播放按钮（预留）
- 自动保存功能
- 删除对话功能

#### 重构组件

**ShotCard** (`shot-card.tsx`)
完全重写，新增功能：
- ✅ 角色列表区域
  - 显示所有镜头中的角色
  - 头像展示
  - 位置标记（左/中/右/前/后）
  - 移除角色功能
  - [+添加角色] 按钮
  
- ✅ 对话序列区域
  - 有序显示所有对话
  - 集成 DialogueEditor 组件
  - 显示对话数量徽章
  - [+添加对话] 按钮

- ✅ 保留原有功能
  - 景别和运镜选择
  - 画面描述编辑
  - 时长设置
  - 拖拽排序
  - 自动保存

**ShotGrid** (`shot-grid.tsx`)
- 更新类型定义，传递完整的角色数据（包含 CharacterImage）
- 将 characters 数据传递给 ShotCard

## 数据流程

```mermaid
graph TB
    A[ShotGrid] -->|加载分镜| B[getEpisodeShots]
    B -->|返回ShotDetail[]| C[包含shotCharacters和dialogues]
    
    C --> D[ShotCard组件]
    D --> E[角色列表区域]
    D --> F[对话序列区域]
    
    E -->|点击添加| G[CharacterSelectorDialog]
    G -->|提交| H[addCharacterToShot]
    H -->|刷新| A
    
    F -->|点击添加| I[创建空对话]
    I -->|addDialogueToShot| A
    
    F -->|编辑对话| J[DialogueEditor]
    J -->|自动保存| K[updateShotDialogue]
    K -->|刷新| A
```

## 技术特性

### 1. 级联删除
- 删除 shot 时，自动删除所有关联的 shotCharacter 和 shotDialogue
- 删除 character 时，shotCharacter 级联删除，shotDialogue 的 characterId 设为 null

### 2. 自动保存
- 对话内容编辑后 1 秒自动保存
- 分镜基础信息编辑后 1 秒自动保存
- 保存状态提示（保存中、已保存、错误）

### 3. 排序管理
- 角色按 order 字段排序显示
- 对话按 order 字段排序显示
- 支持拖拽重排（预留功能）

### 4. 用户体验
- 内联编辑，无需弹窗
- 实时预览
- 视觉反馈（hover效果、徽章计数）
- 情绪emoji直观展示

## 数据库迁移说明

⚠️ **重要**：用户需要手动执行以下命令来应用数据库变更：

```bash
npm run db:generate
npm run db:push
```

如果有现有生产数据，需要创建迁移脚本将：
- `shot.dialogue` → `shot_dialogue` 表
- `shot.mainCharacterId` → `shot_character` 表

## 后续优化建议

1. **拖拽排序**
   - 对话列表支持拖拽重排
   - 使用 @dnd-kit（已安装）

2. **音频功能**
   - TTS生成对话音频
   - 音频播放器
   - 音频混音合成

3. **批量操作**
   - 批量添加角色
   - 从剧本自动提取对话

4. **AI辅助**
   - 智能分配说话人
   - 情绪自动识别
   - 对话优化建议

5. **视频生成**
   - 多角色对口型
   - 角色位置布局
   - 时间轴精确控制

## 文件清单

### 修改的文件
- `src/lib/db/schemas/project.ts` - 数据库schema
- `src/types/project.ts` - TypeScript类型定义
- `src/lib/actions/project/shot.ts` - Server actions
- `src/lib/actions/project/index.ts` - Actions导出
- `src/components/projects/storyboard/shot-card.tsx` - 分镜卡片（完全重写）
- `src/components/projects/storyboard/shot-grid.tsx` - 分镜网格

### 新增的文件
- `src/components/projects/storyboard/character-selector-dialog.tsx` - 角色选择对话框
- `src/components/projects/storyboard/dialogue-editor.tsx` - 对话编辑器
- `SHOT_MULTI_CHARACTER_REFACTOR.md` - 本文档

## 测试检查清单

- [ ] 创建新分镜，添加多个角色
- [ ] 为分镜添加多段对话，测试排序
- [ ] 编辑对话内容，验证自动保存
- [ ] 删除角色，验证相关对话的说话人字段处理
- [ ] 删除分镜，验证关联数据级联删除
- [ ] 旁白对话（无说话人）的显示和编辑
- [ ] 不同情绪标签的选择和显示
- [ ] 角色位置标签的显示

## 结论

✅ 所有计划功能已成功实施
✅ 无 linter 错误
✅ 代码质量良好，遵循项目规范
✅ UI/UX 优化，支持内联编辑和自动保存

分镜功能现已支持完整的多角色多对话工作流，为后续的AI生成和视频制作奠定了坚实基础。

