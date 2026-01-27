# Kie.ai Gemini 3 Flash API 测试报告

日期: 2026-01-27

## 问题背景

在将 Agent 切换到 Gemini 后，API 返回 500 错误：
```
{"code":500,"msg":"Server exception, please try again later"}
```

## 测试过程与结果

### 1. 基础功能测试

| 测试项 | 结果 |
|--------|------|
| 简单消息 + 1个 tool | ✅ 成功 |
| 流式响应 (stream: true) | ✅ 成功 |
| include_thoughts + reasoning_effort | ✅ 成功 |
| content 数组格式 `[{type: "text", text: "..."}]` | ✅ 成功 |
| system 消息 | ✅ 成功 |

### 2. Tool 数量测试

| 测试项 | 结果 |
|--------|------|
| 10 个简单 tools | ✅ 成功 |
| 15 个简单 tools | ✅ 成功 |
| 18 个简单 tools | ✅ 成功 |
| 19 个简单 tools | ✅ 成功 |
| 20 个简单 tools | ✅ 成功 |
| 20 个中文 description tools | ✅ 成功 |

### 3. 多轮对话测试

| 测试项 | 结果 |
|--------|------|
| user + assistant(tool_calls) + tool 消息 | ✅ 成功 |
| content 为空字符串 "" | ✅ 成功 |
| content 为 `[{type: "text", text: ""}]` (空文本) | ❌ 失败 (422) |

**发现问题 1**: 当 content 是数组格式且 text 为空字符串时，API 返回：
```
{"code":422,"msg":"The 'text' field within the message content cannot be empty."}
```

### 4. 复杂请求测试

| 测试项 | 结果 |
|--------|------|
| 长 system prompt + 20 个简单 tools | ✅ 成功 |
| 2 个长 description tools + 18 个简单 tools | ✅ 成功 |
| 嵌套 parameters (array of objects) | ✅ 成功 |
| 20 个带完整 description 的 tools (简化版) | ❌ 失败 (500) |
| 实际应用的完整请求 (长 system + 20 个完整 tools) | ❌ 失败 (500) |

## 结论

### 确认的问题

1. **空 text 字段问题** (已修复)
   - 当 assistant 消息只有 tool_calls 没有文本时，content 为空
   - 如果使用 `[{type: "text", text: ""}]` 格式会报 422 错误
   - 解决方案：空内容时使用字符串格式 `""`

2. **请求大小限制** (未解决)
   - API 对请求总大小有限制
   - 20 个简单 tools 可以工作
   - 20 个带完整 description 的 tools 会报 500 错误
   - 具体限制阈值不明确，可能是 token 数或字节数

### 令人困惑的地方

- 500 错误没有明确的错误信息，只返回 "Server exception"
- 无法确定具体是哪个参数或哪个 tool 导致的问题
- 相同数量的 tools，简化 description 后可能成功，也可能失败
- 限制似乎与 tools 数量、description 长度、system prompt 长度的组合有关

## 建议的解决方案

1. **精简 tool descriptions** - 移除示例代码、详细说明，只保留核心描述
2. **减少 tools 数量** - 合并相似功能，或动态选择相关 tools
3. **精简 system prompt** - 移除冗余内容
4. **联系 Kie.ai** - 询问具体的请求大小限制

## 代码修复

已修复 `convertToGeminiMessages` 函数，处理空 content 的情况：

```typescript
// assistant 消息带 tool_calls：content 为空时使用字符串格式
if (msg.role === "assistant" && msg.tool_calls) {
  return {
    role: "assistant",
    content: msg.content || "",  // 使用字符串而非数组
    tool_calls: msg.tool_calls,
  };
}
```
