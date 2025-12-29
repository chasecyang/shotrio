# Agent 拒绝多 Tool Calls 错误修复

## 问题描述

当用户拒绝 Agent 的操作时，如果 AI 返回的 assistant 消息包含多个 `tool_calls`，但系统只为第一个添加了拒绝的 tool message，导致 OpenAI API 返回 400 错误：

```
400 An assistant message with 'tool_calls' must be followed by tool messages 
responding to each 'tool_call_id'. (insufficient tool messages following tool_calls message)
```

## 根本原因

OpenAI API 要求：一个包含 `tool_calls` 的 assistant 消息后面必须跟随**对应每个 `tool_call_id`** 的 tool 消息。

原代码只处理了 `state.pendingAction` 对应的一个 tool_call，如果存在多个 tool_calls，其他的就没有对应的 tool message，导致消息历史不完整。

## 解决方案

修改 `src/lib/services/agent-engine/engine.ts` 中的 `resumeConversation` 方法（第 151-240 行），在用户拒绝时：

1. **找到最后一条 assistant 消息**
2. **获取该消息的所有 tool_calls**
3. **为每个 tool_call 创建拒绝的 tool message**
4. **批量保存到数据库**（使用 Promise.all 提高性能）
5. **发送所有 tool_call_end 事件**

### 核心逻辑流程

```
用户拒绝
  ↓
找到最后的 assistant 消息
  ↓
获取所有 tool_calls
  ↓
为每个 tool_call:
  - 创建拒绝的 tool message
  - 添加到 state.messages
  - 保存到数据库
  ↓
发送所有 tool_call_end 事件
  ↓
创建新的 assistant message
  ↓
继续对话循环
```

## 关键代码变更

### Before（只处理一个 tool_call）

```typescript
if (state.pendingAction) {
  const rejectedToolCallId = state.pendingAction.functionCall.id;
  const rejectedToolCallName = state.pendingAction.functionCall.name;

  // 只为一个 tool_call 添加拒绝消息
  const toolMessage: Message = {
    role: "tool",
    content: JSON.stringify({
      success: false,
      error: "用户拒绝了此操作",
      userRejected: true,
    }),
    tool_call_id: rejectedToolCallId,
  };
  state.messages.push(toolMessage);
  
  await saveToolMessage(
    state.conversationId,
    toolMessage.tool_call_id!,
    toolMessage.content
  );

  yield {
    type: "tool_call_end",
    data: {
      id: rejectedToolCallId,
      name: rejectedToolCallName,
      success: false,
      error: "用户拒绝了此操作",
    },
  };
}
```

### After（处理所有 tool_calls）

```typescript
// 找到最后一条 assistant 消息
const lastAssistantMessage = [...state.messages]
  .reverse()
  .find(m => m.role === "assistant");

if (lastAssistantMessage?.tool_calls && lastAssistantMessage.tool_calls.length > 0) {
  console.log(`[AgentEngine] 为 ${lastAssistantMessage.tool_calls.length} 个 tool_calls 添加拒绝消息`);
  
  const rejectionContent = JSON.stringify({
    success: false,
    error: "用户拒绝了此操作",
    userRejected: true,
  });

  // 并行保存所有 tool messages
  const savePromises = lastAssistantMessage.tool_calls.map(async (toolCall) => {
    const toolMessage: Message = {
      role: "tool",
      content: rejectionContent,
      tool_call_id: toolCall.id,
    };
    state.messages.push(toolMessage);
    
    await saveToolMessage(
      state.conversationId,
      toolMessage.tool_call_id!,
      toolMessage.content
    );

    return toolCall;
  });

  const rejectedToolCalls = await Promise.all(savePromises);

  // 发送所有 tool_call_end 事件
  for (const toolCall of rejectedToolCalls) {
    yield {
      type: "tool_call_end",
      data: {
        id: toolCall.id,
        name: toolCall.function.name,
        success: false,
        error: "用户拒绝了此操作",
      },
    };
  }
} else if (state.pendingAction) {
  // 降级逻辑：保持向后兼容
  console.warn("[AgentEngine] 未找到 assistant 消息的 tool_calls，使用 pendingAction 降级处理");
  // ... 原逻辑 ...
}
```

## 特性

1. **完整性**：确保所有 tool_calls 都有对应的 tool message，满足 OpenAI API 要求
2. **性能优化**：使用 `Promise.all` 并行保存多个 tool messages
3. **向后兼容**：如果找不到 assistant 消息的 tool_calls，降级到使用 `pendingAction`
4. **日志追踪**：添加详细日志，方便调试

## 测试场景

### 场景 1：用户拒绝单个 tool_call（正常场景）
- AI 返回 1 个 tool_call
- 用户拒绝
- ✅ 创建 1 个拒绝的 tool message
- ✅ 对话继续正常进行

### 场景 2：用户拒绝多个 tool_calls（修复的场景）
- AI 返回多个 tool_calls（触发 bug 的场景）
- 用户拒绝
- ✅ 为所有 tool_calls 创建拒绝的 tool message
- ✅ 消息历史完整，不会报 400 错误
- ✅ 对话继续正常进行

### 场景 3：用户接受操作
- 不受此修复影响
- ✅ 正常执行 tool 并继续

### 场景 4：降级场景
- 如果 state.messages 中找不到 assistant 消息的 tool_calls
- ✅ 使用 pendingAction 降级处理
- ✅ 保持向后兼容

## 验证方法

1. 运行应用
2. 与 Agent 对话，触发需要确认的操作
3. 点击"拒绝"按钮
4. 观察控制台日志：
   - 应该看到 `[AgentEngine] 为 X 个 tool_calls 添加拒绝消息`
   - 不应该看到 400 错误
5. 检查对话是否正常继续

## 修改文件

- `src/lib/services/agent-engine/engine.ts` (第 151-240 行)

## 日期

2025-12-29

