# 场景模块重构 - 数据库迁移指南

## 概述

场景模块已成功重构，简化了数据结构并聚焦于两张核心图片：
- **Master Layout** (全景布局图) - 建立空间认知
- **45° View** (叙事主力视角) - 90%对话和动作镜头的核心视角

## 数据库变更

### Scene 表
移除字段：
- `location` - 位置标注
- `time_of_day` - 时间段

保留字段：
- `name` - 场景名称
- `description` - 场景描述（现在包含所有信息）

### SceneImage 表
主要变更：
- `label` (text) → `image_type` (enum: 'master_layout' | 'quarter_view')
- 移除 `is_primary` 字段（现在固定使用 quarter_view 作为封面）

## 迁移步骤

### 1. 生成迁移文件

```bash
npx drizzle-kit generate
```

这将根据 schema 变更自动生成迁移 SQL 文件。

### 2. 手动调整迁移文件（如果需要）

如果自动生成的迁移不完整，请编辑迁移文件并添加以下逻辑：

```sql
-- 1. 创建场景图片类型枚举
DO $$ BEGIN
  CREATE TYPE scene_image_type AS ENUM ('master_layout', 'quarter_view');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. 添加临时列
ALTER TABLE scene_image ADD COLUMN IF NOT EXISTS image_type_temp scene_image_type;

-- 3. 迁移现有数据（根据 label 推断类型）
UPDATE scene_image SET image_type_temp = 
  CASE 
    WHEN label ILIKE '%全景%' OR label ILIKE '%wide%' OR label ILIKE '%establishing%' 
      THEN 'master_layout'::scene_image_type
    WHEN label ILIKE '%45%' OR label ILIKE '%quarter%' OR label ILIKE '%侧面%' 
      THEN 'quarter_view'::scene_image_type
    ELSE 'quarter_view'::scene_image_type  -- 默认
  END
WHERE image_type_temp IS NULL;

-- 4. 删除旧列并重命名
ALTER TABLE scene_image DROP COLUMN IF EXISTS label;
ALTER TABLE scene_image RENAME COLUMN image_type_temp TO image_type;
ALTER TABLE scene_image ALTER COLUMN image_type SET NOT NULL;

-- 5. 删除不再使用的字段
ALTER TABLE scene DROP COLUMN IF EXISTS location;
ALTER TABLE scene DROP COLUMN IF EXISTS time_of_day;
ALTER TABLE scene_image DROP COLUMN IF EXISTS is_primary;

-- 6. 添加唯一索引（每个场景最多两张图片）
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_image_unique_type 
  ON scene_image(scene_id, image_type);
```

### 3. 执行迁移

```bash
npx drizzle-kit push
```

或者如果使用 migrate 命令：

```bash
npm run db:migrate
```

### 4. 验证迁移

连接到数据库并验证：

```sql
-- 检查 scene 表结构
\d scene

-- 检查 scene_image 表结构
\d scene_image

-- 检查现有数据
SELECT s.name, si.image_type, si.image_url IS NOT NULL as has_image
FROM scene s
LEFT JOIN scene_image si ON si.scene_id = s.id
ORDER BY s.created_at DESC;
```

## 功能变更

### 前端变化

1. **场景创建对话框**
   - 移除了"位置标注"和"时间段"字段
   - 场景描述现在是唯一的描述性字段

2. **场景卡片**
   - 优先显示 `quarter_view` 作为封面
   - 新的状态徽章系统：
     - "未完善设定" - 没有描述
     - "待生成 Master Layout" - 有描述但无全景图
     - "待生成 45° View" - 有全景图但无叙事视角
     - "已完成" - 两张图都有

3. **场景详情页**
   - 引导式生成流程
   - 必须先生成 Master Layout，才能生成 45° View
   - 进度条显示完成度（0% / 50% / 100%）

### 后端变化

新的 Server Actions：
- `generateMasterLayout()` - 生成全景布局图
- `generateQuarterView()` - 生成叙事视角图
- `saveMasterLayout()` - 保存选择的全景图
- `saveQuarterView()` - 保存选择的叙事视角图
- `regenerateSceneImage()` - 重新生成指定类型的图片

移除的 Actions：
- `generateSceneImages()` (通用生成)
- `saveSceneImage()` (通用保存)
- `setScenePrimaryImage()` (设置主图)
- `generateImageForSceneView()` (异步生成)

## Prompt 模板

新增 `src/lib/prompts/scene.ts`，包含专业的 prompt 模板：

- **Master Layout Prompt**: 强调全景、深度层次、无人物
- **Quarter View Prompt**: 强调 45° 视角、角色站位空间、叙事焦点

## 回滚方案（如果需要）

如果遇到问题需要回滚：

```bash
# 1. 恢复数据库备份
pg_restore -d your_database backup_file.dump

# 2. 或者使用 Git 回退代码
git revert <commit-hash>

# 3. 重新安装依赖
npm install
```

## 测试清单

迁移完成后，请测试以下功能：

- [ ] 创建新场景
- [ ] 添加场景描述
- [ ] 生成 Master Layout（4张候选）
- [ ] 选择并保存 Master Layout
- [ ] 生成 45° View（4张候选）
- [ ] 选择并保存 45° View
- [ ] 重新生成图片
- [ ] 删除场景
- [ ] 查看场景列表（封面显示正确）
- [ ] 场景详情页完成度显示正确

## 注意事项

1. **数据丢失警告**：`location` 和 `time_of_day` 字段的数据将被删除。如果需要保留，请在迁移前将这些信息合并到 `description` 字段。

2. **图片类型映射**：现有的 `scene_image` 记录将根据 `label` 字段自动推断类型。请检查映射是否正确。

3. **唯一约束**：每个场景现在最多只能有 2 张图片（每种类型一张）。如果现有数据中有多张同类型图片，只保留最新的一张。

## 支持

如有问题，请查看：
- `/docs/SCENE_MODULE_IMPLEMENTATION.md` - 原始实现文档
- `/SCENE_MODULE_IMPLEMENTATION.md` - 模块说明
- 或联系开发团队

---

**迁移完成时间**: 待执行
**最后更新**: 2025-12-10

