# Asset状态管理重构 - 执行和测试指南

## 概述

本次重构移除了asset表中的`status`和`errorMessage`字段，改为从关联的job动态计算状态。

### 主要变化

1. **数据库层面**：
   - ✅ 新增 `asset.sourceType` 字段（'generated' | 'uploaded'）
   - ✅ 移除 `asset.status` 字段
   - ✅ 移除 `asset.errorMessage` 字段

2. **代码层面**：
   - ✅ 所有查询自动JOIN job表并计算运行时状态
   - ✅ Worker不再更新asset状态
   - ✅ 前端组件使用`AssetWithRuntimeStatus`类型

## 执行步骤

### 1. 代码部署前检查

在运行迁移前，确保所有改动已提交：

```bash
# 检查是否有未提交的改动
git status

# 查看改动的文件
git diff --stat

# 提交所有改动
git add .
git commit -m "refactor: Asset状态管理重构 - 从job动态计算状态"
```

### 2. 备份数据库（重要！）

在生产环境执行迁移前，**务必备份数据库**：

```bash
# 导出数据库备份
pg_dump -h your-db-host -U your-db-user -d your-db-name > backup_$(date +%Y%m%d_%H%M%S).sql

# 或使用你的云服务商的备份工具
```

### 3. 在测试/开发环境执行迁移

```bash
# 1. 停止所有worker进程（避免状态不一致）
pm2 stop all  # 或使用你的进程管理工具

# 2. 执行迁移脚本
psql -h your-db-host -U your-db-user -d your-db-name < migrations/20250101000000-remove-asset-status.sql

# 3. 检查迁移输出
# 应该显示：
# - 生成类资产数量
# - 上传类资产数量
# - 总计数量

# 4. 验证数据库结构
psql -h your-db-host -U your-db-user -d your-db-name -c "\d asset"
# 确认：source_type 字段存在，status 和 error_message 字段不存在
```

### 4. 重新部署应用

```bash
# 1. 拉取最新代码
git pull

# 2. 安装依赖（如果有新增）
npm install

# 3. 构建应用
npm run build

# 4. 重启应用和worker
pm2 restart all
```

### 5. 功能测试

按以下顺序测试各项功能：

#### 5.1 上传资产测试

1. 打开项目编辑器
2. 点击"上传"按钮
3. 选择一张图片上传
4. ✅ 确认资产立即显示为"已完成"状态
5. ✅ 确认可以正常查看和删除

#### 5.2 AI生成图片测试

1. 点击"AI 生成"
2. 输入提示词生成图片
3. ✅ 确认资产显示为"等待中"或"生成中"状态
4. ✅ 确认进度条正常显示
5. ✅ 生成完成后自动变为"已完成"状态
6. ✅ 确认可以正常查看生成的图片

#### 5.3 AI生成视频测试

1. 在项目中创建视频资产
2. ✅ 确认资产显示为"等待中"或"生成中"状态
3. ✅ 等待生成完成（可能需要几分钟）
4. ✅ 确认生成完成后状态更新为"已完成"
5. ✅ 确认可以播放视频

#### 5.4 失败场景测试

1. 尝试生成一个会失败的任务（如无效的提示词）
2. ✅ 确认资产显示为"失败"状态
3. ✅ 确认显示错误信息
4. ✅ 确认可以删除失败的资产

#### 5.5 异常恢复测试

1. 查找数据库中是否有旧的异常状态资产：

```sql
-- 查找生成类资产但没有关联job的情况
SELECT a.id, a.name, a.source_type, a.image_url, a.video_url
FROM asset a
WHERE a.source_type = 'generated'
AND NOT EXISTS (
  SELECT 1 FROM job j 
  WHERE j.input_data->>'assetId' = a.id
  AND j.type IN ('asset_image_generation', 'video_generation')
)
LIMIT 10;
```

2. ✅ 确认这些资产在前端显示合理的状态（有文件URL的显示完成，无文件的显示失败）

#### 5.6 性能测试

1. 打开一个有大量资产的项目（50+ 资产）
2. ✅ 确认素材列表加载速度可接受（< 2秒）
3. ✅ 查看浏览器开发工具的Network标签
4. ✅ 确认没有额外的重复请求

### 6. 监控和日志

运行迁移后，监控以下内容：

```bash
# 查看应用日志
pm2 logs

# 查看Worker日志
pm2 logs standalone-worker

# 关注以下内容：
# - 是否有关于asset.status的错误
# - 查询性能是否正常
# - Worker是否正常处理任务
```

### 7. 回滚计划（如果需要）

如果发现严重问题需要回滚：

```bash
# 1. 停止所有worker进程
pm2 stop all

# 2. 执行回滚脚本
psql -h your-db-host -U your-db-user -d your-db-name < migrations/20250101000001-rollback-asset-status.sql

# 3. 回退到旧版本代码
git checkout <previous-commit>
npm install
npm run build

# 4. 重启应用
pm2 restart all
```

## 常见问题排查

### Q1: 前端显示类型错误

**症状**: 浏览器控制台显示类型错误，如"runtimeStatus is undefined"

**解决方案**:
1. 清除浏览器缓存
2. 重新构建前端：`npm run build`
3. 确认所有组件都使用`AssetWithRuntimeStatus`类型

### Q2: 查询性能下降

**症状**: 素材列表加载缓慢

**解决方案**:
1. 检查数据库是否有适当的索引
2. 如果资产数量很大（1000+），考虑添加索引：

```sql
-- 为job.inputData添加GIN索引（如果还没有）
CREATE INDEX IF NOT EXISTS idx_job_input_data_asset_id 
ON job USING GIN (input_data);

-- 为job.type添加索引
CREATE INDEX IF NOT EXISTS idx_job_type 
ON job (type);
```

### Q3: 旧的异常资产状态显示不正确

**症状**: 某些旧资产显示为"失败"但实际上已完成

**解决方案**:
手动修复这些资产的sourceType：

```sql
-- 查找有文件但没有job的资产
UPDATE asset 
SET source_type = 'uploaded'
WHERE (image_url IS NOT NULL OR video_url IS NOT NULL)
AND source_type = 'generated'
AND id NOT IN (
  SELECT DISTINCT CAST(input_data->>'assetId' AS TEXT)
  FROM job 
  WHERE type IN ('asset_image_generation', 'video_generation')
  AND input_data->>'assetId' IS NOT NULL
);
```

## 验收标准

所有以下项目必须通过才能视为迁移成功：

- [ ] 数据库迁移无错误完成
- [ ] 上传的资产立即显示为完成状态
- [ ] 生成的资产正确显示进度状态
- [ ] 失败的任务正确显示失败状态和错误信息
- [ ] 可以正常删除各种状态的资产
- [ ] 素材列表加载速度正常（< 2秒）
- [ ] Worker正常处理任务
- [ ] 应用日志无错误
- [ ] 所有测试场景通过

## 联系和支持

如有问题，请：
1. 查看应用日志和Worker日志
2. 检查数据库连接和数据完整性
3. 如需回滚，按照回滚计划执行

---

**重要提示**：在生产环境执行前，务必在测试/开发环境完整测试所有功能！

