# Agent Function 参数解析修复

## 修复日期
2024-12-24

## 问题描述

在 `executor.ts` 中，多个 agent function 直接使用 `JSON.parse()` 解析参数，没有做类型检查和错误处理。当 AI 模型传递的参数已经是对象/数组（而不是 JSON 字符串）时，会导致解析错误：

```
SyntaxError: Unexpected non-whitespace character after JSON at position 2 (line 1 column 3)
```

## 修复的函数

修复了以下 6 个函数的参数解析逻辑：

### 1. `generate_asset` - sourceAssetIds 参数

**位置**：第 292-296 行

**问题**：直接使用 `JSON.parse(parameters.sourceAssetIds as string)`

**修复**：
```typescript
// 解析 sourceAssetIds
let parsedSourceAssetIds: string[] | undefined;
if (parameters.sourceAssetIds) {
  // 如果已经是数组，直接使用
  if (Array.isArray(parameters.sourceAssetIds)) {
    parsedSourceAssetIds = parameters.sourceAssetIds;
  } else {
    // 如果是字符串，尝试解析 JSON
    try {
      const sourceStr = (parameters.sourceAssetIds as string).trim();
      parsedSourceAssetIds = JSON.parse(sourceStr);
    } catch (error) {
      console.error("[executeFunction] 解析 sourceAssetIds 失败:", error);
      // 如果解析失败，尝试按逗号分隔
      parsedSourceAssetIds = (parameters.sourceAssetIds as string)
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
    }
  }
}
```

**支持的格式**：
- 数组：`["id1", "id2"]`
- JSON 字符串：`'["id1", "id2"]'`
- 逗号分隔：`"id1,id2"`

---

### 2. `batch_generate_assets` - assets 参数

**位置**：第 373-379 行

**问题**：直接使用 `JSON.parse(parameters.assets as string)`

**修复**：
```typescript
// 解析 assets 参数，支持数组或 JSON 字符串
let assetsData: Array<{...}>;

if (Array.isArray(parameters.assets)) {
  assetsData = parameters.assets;
} else {
  try {
    assetsData = JSON.parse(parameters.assets as string);
  } catch (error) {
    console.error("[executeFunction] 解析 assets 参数失败:", error);
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "assets 参数格式错误",
    };
  }
}
```

**支持的格式**：
- 数组：`[{name: "素材1", prompt: "..."}, ...]`
- JSON 字符串：`'[{name: "素材1", prompt: "..."}, ...]'`

---

### 3. `batch_create_shots` - shots 参数

**位置**：第 218-228 行

**问题**：直接使用 `JSON.parse(parameters.shots as string)`

**修复**：
```typescript
// 解析 shots 参数，支持数组或 JSON 字符串
let shotsData: Array<{...}>;

if (Array.isArray(parameters.shots)) {
  shotsData = parameters.shots;
} else {
  try {
    shotsData = JSON.parse(parameters.shots as string);
  } catch (error) {
    console.error("[executeFunction] 解析 shots 参数失败:", error);
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "shots 参数格式错误",
    };
  }
}
```

**支持的格式**：
- 数组：`[{shotSize: "...", description: "..."}, ...]`
- JSON 字符串：`'[{shotSize: "...", description: "..."}, ...]'`

---

### 4. `generate_shot_videos` - shotIds 参数

**位置**：第 266-268 行

**问题**：直接使用 `JSON.parse(parameters.shotIds as string)`

**修复**：
```typescript
// 解析 shotIds 参数，支持数组或 JSON 字符串
let shotIds: string[];
if (Array.isArray(parameters.shotIds)) {
  shotIds = parameters.shotIds;
} else {
  try {
    shotIds = JSON.parse(parameters.shotIds as string);
  } catch (error) {
    console.error("[executeFunction] 解析 shotIds 参数失败:", error);
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "shotIds 参数格式错误",
    };
  }
}
```

**支持的格式**：
- 数组：`["id1", "id2"]`
- JSON 字符串：`'["id1", "id2"]'`

---

### 5. `reorder_shots` - shotOrders 参数

**位置**：第 527-530 行

**问题**：直接使用 `JSON.parse(parameters.shotOrders as string)`

**修复**：
```typescript
// 解析 shotOrders 参数，支持对象或 JSON 字符串
let shotOrdersRecord: Record<string, number>;
if (typeof parameters.shotOrders === 'object' && parameters.shotOrders !== null) {
  shotOrdersRecord = parameters.shotOrders as Record<string, number>;
} else {
  try {
    shotOrdersRecord = JSON.parse(parameters.shotOrders as string);
  } catch (error) {
    console.error("[executeFunction] 解析 shotOrders 参数失败:", error);
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "shotOrders 参数格式错误",
    };
  }
}
```

**支持的格式**：
- 对象：`{shotId1: 1, shotId2: 2}`
- JSON 字符串：`'{"shotId1": 1, "shotId2": 2}'`

---

### 6. `delete_shots` - shotIds 参数

**位置**：第 568 行

**问题**：直接使用 `JSON.parse(parameters.shotIds as string)`

**修复**：
```typescript
// 解析 shotIds 参数，支持数组或 JSON 字符串
let shotIds: string[];
if (Array.isArray(parameters.shotIds)) {
  shotIds = parameters.shotIds;
} else {
  try {
    shotIds = JSON.parse(parameters.shotIds as string);
  } catch (error) {
    console.error("[executeFunction] 解析 shotIds 参数失败:", error);
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "shotIds 参数格式错误",
    };
  }
}
```

**支持的格式**：
- 数组：`["id1", "id2"]`
- JSON 字符串：`'["id1", "id2"]'`

---

## 修复策略

所有修复都遵循以下策略：

1. **类型检查优先**：先检查参数是否已经是期望的类型（数组/对象）
2. **再尝试解析**：如果是字符串，尝试 JSON.parse
3. **错误处理**：解析失败时记录错误，返回友好的错误信息
4. **降级处理**（特殊情况）：对于某些参数（如 sourceAssetIds），如果 JSON 解析失败，尝试按逗号分隔

## 效果

- ✅ 修复了 `SyntaxError: Unexpected non-whitespace character` 错误
- ✅ 支持 AI 模型传递对象/数组格式的参数
- ✅ 支持传统的 JSON 字符串格式参数
- ✅ 提供更好的错误提示
- ✅ 提高系统健壮性

## 测试建议

测试所有涉及的 agent functions：

1. `generate_asset` - 生成单个素材
2. `batch_generate_assets` - 批量生成素材
3. `batch_create_shots` - 批量创建分镜
4. `generate_shot_videos` - 生成分镜视频
5. `reorder_shots` - 重新排序分镜
6. `delete_shots` - 删除分镜

确保在各种参数格式下都能正常工作。

## 相关文件

- `/Users/chasecyang/development/cineqo/src/lib/actions/agent/executor.ts`

