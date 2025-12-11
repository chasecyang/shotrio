# 场景提取功能数据库迁移指南

## 迁移概述

场景提取功能需要在数据库中添加新的任务类型枚举值。本文档说明如何执行数据库迁移。

## 变更内容

### 枚举更新

在 `job_type` 枚举中添加新值：`scene_extraction`

**变更前：**
```sql
CREATE TYPE job_type AS ENUM (
  'novel_split',
  'character_extraction',
  'character_image_generation',
  'scene_image_generation',
  'storyboard_generation',
  'batch_image_generation',
  'video_generation'
);
```

**变更后：**
```sql
CREATE TYPE job_type AS ENUM (
  'novel_split',
  'character_extraction',
  'scene_extraction',        -- 新增
  'character_image_generation',
  'scene_image_generation',
  'storyboard_generation',
  'batch_image_generation',
  'video_generation'
);
```

## 迁移步骤

### 方法 1：使用 Drizzle Kit（推荐）

1. **生成迁移文件**

```bash
npm run db:generate
```

这将会检测到 schema 的变化，并生成迁移文件。

2. **检查生成的迁移文件**

查看生成的文件（通常在 `drizzle/` 目录下），确认迁移内容正确。

3. **执行迁移**

```bash
npm run db:push
# 或
npm run db:migrate
```

### 方法 2：手动执行 SQL（仅在必要时）

如果 Drizzle Kit 无法自动处理枚举更新，可以手动执行以下 SQL：

```sql
-- 1. 添加新的枚举值
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'scene_extraction';

-- 注意：PostgreSQL 不支持在枚举中间插入值
-- 如果需要保持顺序，需要重建枚举类型
```

### 方法 3：重建枚举类型（如需保持顺序）

```sql
-- 1. 创建新的枚举类型
CREATE TYPE job_type_new AS ENUM (
  'novel_split',
  'character_extraction',
  'scene_extraction',
  'character_image_generation',
  'scene_image_generation',
  'storyboard_generation',
  'batch_image_generation',
  'video_generation'
);

-- 2. 更新 job 表的类型列
ALTER TABLE job 
ALTER COLUMN type TYPE job_type_new 
USING type::text::job_type_new;

-- 3. 删除旧的枚举类型
DROP TYPE job_type;

-- 4. 重命名新类型
ALTER TYPE job_type_new RENAME TO job_type;
```

## 验证迁移

### 1. 检查枚举值

```sql
SELECT enum_range(NULL::job_type);
```

应该看到包含 `scene_extraction` 的列表。

### 2. 测试插入

```sql
-- 测试插入新类型的任务
INSERT INTO job (id, user_id, project_id, type, status, progress, current_step)
VALUES (
  'test-scene-extraction',
  'test-user-id',
  'test-project-id',
  'scene_extraction',  -- 新类型
  'pending',
  0,
  0
);

-- 查询验证
SELECT * FROM job WHERE type = 'scene_extraction';

-- 清理测试数据
DELETE FROM job WHERE id = 'test-scene-extraction';
```

## 回滚方案

如果需要回滚迁移：

### 方法 1：删除枚举值（不推荐）

**警告：** PostgreSQL 不支持直接删除枚举值。如果表中已有该类型的记录，回滚会失败。

### 方法 2：重建枚举类型

```sql
-- 1. 检查是否有使用新类型的记录
SELECT COUNT(*) FROM job WHERE type = 'scene_extraction';

-- 2. 如果有记录，先删除
DELETE FROM job WHERE type = 'scene_extraction';

-- 3. 重建枚举类型（不包含新值）
CREATE TYPE job_type_rollback AS ENUM (
  'novel_split',
  'character_extraction',
  'character_image_generation',
  'scene_image_generation',
  'storyboard_generation',
  'batch_image_generation',
  'video_generation'
);

-- 4. 更新表
ALTER TABLE job 
ALTER COLUMN type TYPE job_type_rollback 
USING type::text::job_type_rollback;

-- 5. 删除新类型
DROP TYPE job_type;

-- 6. 重命名
ALTER TYPE job_type_rollback RENAME TO job_type;
```

## 环境配置

### 开发环境

```bash
# .env.local
DATABASE_URL=your_dev_database_url
```

执行迁移：
```bash
npm run db:push
```

### 生产环境

**重要提示：** 在生产环境执行迁移前，请确保：

1. ✅ 已在开发/测试环境验证迁移
2. ✅ 已备份生产数据库
3. ✅ 已通知相关人员（如有正在运行的任务）
4. ✅ 选择低峰时段执行

```bash
# 1. 备份数据库
pg_dump -U username -d database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 执行迁移
npm run db:migrate

# 3. 验证迁移
npm run db:studio
```

## 常见问题

### Q1: Drizzle Kit 无法检测到枚举变化

**解决方法：**
```bash
# 强制重新生成
rm -rf drizzle/
npm run db:generate
```

### Q2: 迁移时报错 "cannot add enum value in a transaction"

**原因：** PostgreSQL 不允许在事务中添加枚举值。

**解决方法：** 确保迁移脚本不在事务中执行，或使用方法 3 重建枚举。

### Q3: 生产环境迁移失败

**立即操作：**
1. 停止应用服务
2. 从备份恢复数据库
3. 检查错误日志
4. 在测试环境重现问题
5. 修复后重新执行

## 迁移检查清单

- [ ] 已更新 `src/lib/db/schemas/project.ts`
- [ ] 已更新 `src/types/job.ts`
- [ ] 已生成迁移文件
- [ ] 已在开发环境测试
- [ ] 已验证枚举值正确
- [ ] 已测试新功能
- [ ] 已备份生产数据库（如适用）
- [ ] 已在生产环境执行迁移（如适用）
- [ ] 已验证生产环境功能

## 相关文档

- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [PostgreSQL 枚举类型](https://www.postgresql.org/docs/current/datatype-enum.html)
- [场景提取功能实现](./SCENE_EXTRACTION_IMPLEMENTATION.md)

---

**注意事项：**

1. 枚举值的顺序在 PostgreSQL 中是固定的，添加新值会默认放在最后
2. 如果需要特定顺序，必须重建整个枚举类型
3. 在生产环境操作前，务必做好备份
4. 建议在低峰时段执行迁移

