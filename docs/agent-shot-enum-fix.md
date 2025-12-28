# Agent 创建分镜枚举值映射修复

## 问题描述

Agent在调用`create_shots`函数时失败，错误信息：

```
Failed query: insert into "shot" ... params: ...,WIDE,STATIC,...
```

**根本原因**：Agent传递的枚举值格式与数据库schema不匹配

- Agent使用：`WIDE`、`STATIC`（大写简化值）
- 数据库需要：`long_shot`、`static`（小写下划线格式）

## 解决方案

### 1. 添加枚举值映射函数

在 `src/lib/actions/agent/executor.ts` 中添加了两个映射函数：

- `mapShotSize()`: 将简化的景别值映射到数据库枚举
- `mapCameraMovement()`: 将简化的运镜值映射到数据库枚举

#### shotSize 映射规则

| 简化值 (Agent使用) | 数据库值 | 中文说明 |
|-------------------|---------|---------|
| WIDE | long_shot | 远景 |
| FULL | full_shot | 全景 |
| MEDIUM | medium_shot | 中景 |
| CLOSE_UP | close_up | 特写 |
| EXTREME_CLOSE_UP | extreme_close_up | 大特写 |
| EXTREME_LONG_SHOT | extreme_long_shot | 大远景 |

#### cameraMovement 映射规则

| 简化值 (Agent使用) | 数据库值 | 中文说明 |
|-------------------|---------|---------|
| STATIC | static | 固定镜头 |
| PUSH_IN | push_in | 推镜头 |
| PULL_OUT | pull_out | 拉镜头 |
| PAN_LEFT | pan_left | 左摇 |
| PAN_RIGHT | pan_right | 右摇 |
| TILT_UP | tilt_up | 上摇 |
| TILT_DOWN | tilt_down | 下摇 |
| TRACKING | tracking | 移动跟拍 |
| CRANE_UP | crane_up | 升镜头 |
| CRANE_DOWN | crane_down | 降镜头 |
| ORBIT | orbit | 环绕 |
| ZOOM_IN | zoom_in | 变焦推进 |
| ZOOM_OUT | zoom_out | 变焦拉远 |
| HANDHELD | handheld | 手持 |

### 2. 更新函数执行逻辑

#### create_shots

- 在验证数据时调用映射函数
- 添加try-catch捕获映射错误
- 返回清晰的错误信息

#### update_shots

- 同样在更新前映射枚举值
- 为每个更新独立处理映射错误

### 3. 更新函数定义文档

在 `src/lib/actions/agent/functions.ts` 中更新了函数描述：

- `create_shots`: 在参数描述中明确列出所有可用的枚举值
- `update_shots`: 同样列出枚举值供Agent参考

## 代码变更

### executor.ts

```typescript
// 新增映射函数
function mapShotSize(value: string): string { ... }
function mapCameraMovement(value: string): string { ... }

// create_shots 中使用
const validatedShots = shots.map((shotData) => ({
  shotSize: mapShotSize(shotData.shotSize),
  cameraMovement: shotData.cameraMovement 
    ? mapCameraMovement(shotData.cameraMovement)
    : undefined,
  ...
}));

// update_shots 中使用
if (fields.shotSize) {
  mappedFields.shotSize = mapShotSize(fields.shotSize);
}
if (fields.cameraMovement) {
  mappedFields.cameraMovement = mapCameraMovement(fields.cameraMovement);
}
```

### functions.ts

```typescript
shots: {
  type: "array",
  description: "分镜数组，...\n\nshotSize枚举值: WIDE(远景), FULL(全景), MEDIUM(中景), ...\n\ncameraMovement枚举值: STATIC(固定), PUSH_IN(推镜头), ...",
}
```

## 特性

1. **灵活性**：同时支持简化值（大写）和数据库值（小写下划线）
2. **容错性**：映射函数会尝试转换大小写，提高兼容性
3. **清晰的错误信息**：当值无效时，返回支持的所有枚举值列表
4. **向后兼容**：不影响已有的直接使用数据库值的代码

## 测试建议

测试Agent创建分镜的场景：

```
用户: "生成一个远景固定镜头"
Agent: 调用 create_shots({ shots: [{ shotSize: "WIDE", cameraMovement: "STATIC", ... }] })
结果: ✅ 成功创建，映射为 { shotSize: "long_shot", cameraMovement: "static" }
```

测试Agent更新分镜的场景：

```
用户: "把第一个镜头改成特写推镜头"
Agent: 调用 update_shots({ updates: [{ shotId: "xxx", shotSize: "CLOSE_UP", cameraMovement: "PUSH_IN" }] })
结果: ✅ 成功更新，映射为正确的数据库值
```

## 总结

通过添加枚举值映射层，解决了Agent和数据库之间的格式不匹配问题，使得Agent可以使用更自然、更简洁的枚举值，同时保持与数据库schema的兼容性。

