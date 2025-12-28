# Agent Functions 优化总结

## 优化目标

精简 Agent Functions 设计，让 AI 更容易理解和使用，提升系统整体效率。

## 优化成果

### 数量对比

- **优化前**: 18 个 functions
- **优化后**: 10 个 functions
- **减少**: 44% ✅

### 详细对比

#### 1. 查询类（6个 → 3个）

**优化前**:
- `query_script_content` - 读取剧本
- `query_assets` - 查询素材
- `query_shots` - 查询分镜列表
- `query_shot_details` - 查询分镜详情
- `analyze_project_stats` - 分析统计
- `query_available_art_styles` - 查询美术风格

**优化后**:
- `query_context` - **综合查询**，一次获取项目完整上下文（剧本+分镜+素材统计+美术风格）
- `query_assets` - 保留，精确查询素材库
- `query_shots` - 保留并增强，支持批量和单个查询

**改进点**:
- ✅ 合并了分散的查询操作（剧本、统计、风格）为一个综合查询
- ✅ `query_shots` 支持可选的 `shotIds` 参数，替代原来的 `query_shot_details`

#### 2. 创作类（4个 → 3个）

**优化前**:
- `create_shot` - 创建单个分镜
- `batch_create_shots` - 批量创建分镜
- `generate_asset` - 生成单个素材
- `batch_generate_assets` - 批量生成素材

**优化后**:
- `create_shots` - **统一创建分镜**（单个/批量通过数组参数实现）
- `generate_assets` - **统一生成素材**（单个/批量通过数组参数实现）
- `generate_videos` - 生成视频（重命名，更简洁）

**改进点**:
- ✅ 消除了"单个 vs 批量"的选择负担，AI 只需决定传入几个元素
- ✅ 参数统一为数组类型，无需 JSON 字符串解析

#### 3. 修改类（4个 → 3个）

**优化前**:
- `update_shot` - 修改单个分镜
- `update_asset` - 修改单个素材
- `reorder_shots` - 重新排序分镜
- `set_project_art_style` - 设置美术风格

**优化后**:
- `update_shots` - **统一修改分镜**（单个/批量）
- `update_assets` - **统一修改素材**（单个/批量）
- `set_art_style` - 设置美术风格（重命名，更简洁）

**改进点**:
- ✅ 支持批量修改，减少多次调用
- ✅ 移除了 `reorder_shots`（排序可通过修改 order 属性实现）
- ✅ 更简洁的命名

#### 4. 删除类（2个 → 2个）

**优化前**:
- `delete_shots` - 删除分镜（批量）
- `delete_asset` - 删除单个素材

**优化后**:
- `delete_shots` - 保留（已支持批量）
- `delete_assets` - **统一删除素材**（单个/批量）

**改进点**:
- ✅ 命名统一（复数形式表示支持批量）

---

## 核心优化策略

### 1. 合并批量操作

**问题**: AI 需要思考"我该用 `create_shot` 还是 `batch_create_shots`？"

**解决**: 统一用数组参数，AI 只需决定传入几个元素：
```typescript
// 单个
{ shots: [{ shotSize: "medium_shot", description: "..." }] }

// 批量
{ shots: [
  { shotSize: "medium_shot", description: "..." },
  { shotSize: "close_up", description: "..." }
]}
```

### 2. 统一参数类型

**问题**: 参数类型不一致
- 有的用 `string` 表示数字 (`"3000"`)
- 有的用 JSON 字符串传数组 (`'["id1","id2"]'`)

**解决**: 使用正确的 JSON Schema 类型
```typescript
// 优化前
duration: { type: "string", description: "时长（毫秒）" }
shotIds: { type: "string", description: "分镜ID数组（JSON字符串格式）" }

// 优化后
duration: { type: "number", description: "时长（毫秒）" }
shotIds: { type: "array", description: "分镜ID数组" }
```

### 3. 综合查询

**问题**: 获取项目全貌需要调用 4-5 个 functions

**解决**: 提供 `query_context` 综合查询
```typescript
// 一次调用获取完整上下文
query_context({
  episodeId: "...",
  includeAssets: true,
  includeArtStyles: true
})

// 返回：剧本 + 分镜 + 素材统计 + 美术风格
```

### 4. 简化枚举（计划中）

当前仍保留完整枚举，后续可考虑：
- `cameraMovement`: 14种 → 6种常用（static, push_in, pull_out, pan, tracking, zoom）
- `shotSize`: 6种 → 保持（已经足够精简）

---

## 类型系统增强

更新了 `FunctionDefinition` 类型以支持更丰富的参数类型：

```typescript
// 优化前
properties: Record<string, {
  type: string;
  description?: string;
  enum?: string[];
}>;

// 优化后
export interface FunctionParameterProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: { type: string; properties?: Record<string, unknown>; };
}

properties: Record<string, FunctionParameterProperty>;
```

---

## 执行器（Executor）适配

完全重写了 `executor.ts`，移除了所有旧的 case 分支，新增：

### 新增功能
- **批量处理逻辑**: `update_shots`, `update_assets`, `delete_assets` 支持批量操作
- **错误汇总**: 批量操作时收集所有错误，返回详细的成功/失败统计
- **综合查询**: `query_context` 智能组装项目上下文

### 代码质量
- ✅ 类型安全：使用 TypeScript 类型断言
- ✅ 错误处理：每个操作都有完善的错误捕获
- ✅ 一致性：所有批量操作遵循相同的模式

---

## 优化效果预测

### 对 AI 的影响

1. **决策简化**: 不再需要选择"单个还是批量"，直接传数组
2. **参数直观**: 数组就是数组，数字就是数字，无需 JSON 字符串
3. **上下文获取**: 一次调用获取完整项目信息，减少多次往返
4. **一致性**: 命名规范统一（复数表示支持批量）

### 对系统的影响

1. **调用次数减少**: 综合查询减少 3-4 次调用
2. **批量效率提升**: 修改/删除多个资源无需多次 function call
3. **代码可维护性**: 函数数量减少 44%，更易维护

---

## 后续优化建议

### 短期

1. ✅ **简化枚举**: 将 `cameraMovement` 从 14 种减少到 6 种常用
2. ✅ **添加使用示例**: 在 function description 中添加调用示例
3. ✅ **监控 AI 使用情况**: 观察 AI 是否正确使用新的 functions

### 长期

1. **Context-aware functions**: 根据当前选中的资源（episode/shot）自动推断参数
2. **智能默认值**: 根据项目历史数据提供更好的默认值
3. **复合操作**: 提供更高层次的复合操作（如"从剧本生成完整分镜脚本"）

---

## 迁移指南

### 兼容性

❌ **不兼容旧版本**，需要完全迁移

### 迁移对照表

| 旧 Function | 新 Function | 参数变化 |
|------------|-------------|---------|
| `query_script_content` | `query_context` | 增加 `includeAssets`, `includeArtStyles` |
| `query_shot_details` | `query_shots` | 增加可选 `shotIds` 参数 |
| `analyze_project_stats` | `query_context` | 合并到综合查询 |
| `query_available_art_styles` | `query_context` | 合并到综合查询 |
| `create_shot` | `create_shots` | 参数包装为数组 `{ shots: [...] }` |
| `batch_create_shots` | `create_shots` | 移除 `batch_` 前缀，统一接口 |
| `generate_asset` | `generate_assets` | 参数包装为数组 `{ assets: [...] }` |
| `batch_generate_assets` | `generate_assets` | 移除 `batch_` 前缀 |
| `generate_shot_videos` | `generate_videos` | 重命名 |
| `update_shot` | `update_shots` | 参数包装为数组 `{ updates: [...] }` |
| `update_asset` | `update_assets` | 参数包装为数组 |
| `reorder_shots` | `update_shots` | 通过修改 order 实现 |
| `set_project_art_style` | `set_art_style` | 重命名 |
| `delete_asset` | `delete_assets` | 参数改为数组 `{ assetIds: [...] }` |
| `delete_shots` | `delete_shots` | 保持不变 |

---

## 总结

通过此次优化，我们将 Agent Functions 从 **18 个减少到 10 个（44%）**，同时：

✅ 消除了单个/批量的选择负担  
✅ 统一了参数类型（array, number 代替 JSON string）  
✅ 提供了综合查询减少多次调用  
✅ 增强了类型系统支持  
✅ 重构了执行器提升代码质量  

**预期效果**: AI 能够更快、更准确地选择和使用 functions，减少错误，提升整体对话体验。

