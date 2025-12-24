# Agent Action 拒绝流程修复总结

## 修复日期
2024-12-24

## 问题描述

在用户通过发送新消息拒绝 agent 的 pendingAction 时，存在以下问题：

1. **并发冲突**：异步调用 `resumeConversation` 后立即继续执行，导致两个并发的对话流互相干扰
2. **状态管理混乱**：pendingAction 的清除逻辑分散在多处，UI 状态和后端状态不同步
3. **逻辑不合理**：用户发送新消息时应该作为"拒绝的理由并继续对话"，而不是"拒绝 + 开启新对话"

## 解决方案

### 1. 修改前端发送消息逻辑 (`agent-panel.tsx`)

**改动位置**：`handleSend` 函数（第 226-244 行）

**改动内容**：
- 移除异步拒绝逻辑（不等待完成）
- 改为同步调用 `resumeConversation`，等待完成后直接返回
- 将用户的新消息作为拒绝理由传递给 AI

**改动前**：
```typescript
// 异步拒绝pendingAction，使用新消息作为拒绝理由（不等待完成）
resumeConversation(agent.state.currentConversationId, false, userMessage)
  .catch(error => {
    console.error("[AgentPanel] 拒绝pendingAction失败:", error);
  });
```

**改动后**：
```typescript
// 同步调用 resumeConversation，将新消息作为拒绝理由
await resumeConversation(
  agent.state.currentConversationId, 
  false, 
  `用户拒绝了操作并回复：${userMessage}`
);
// 完成后直接返回，不继续创建新对话
return;
```

**效果**：消除并发冲突，确保拒绝流程完成后才返回

---

### 2. 简化状态管理 (`use-agent-stream.tsx`)

**改动位置 1**：`processStream` 函数的 `state_update` 事件处理（第 78-103 行）

**改动内容**：
- 检查 `state_update` 事件中是否包含 `pendingAction` 字段
- 如果 `pendingAction === undefined`，明确清除前端状态
- 统一由后端通过流式事件管理 pendingAction 的清除

**改动前**：
```typescript
if (event.data.pendingAction !== undefined) {
  // 只在有值时更新
  updates.pendingAction = event.data.pendingAction;
}
```

**改动后**：
```typescript
if ("pendingAction" in event.data) {
  if (event.data.pendingAction === undefined) {
    // 明确清除 pendingAction
    updates.pendingAction = undefined;
    console.log("[Agent Stream] 清除 pendingAction");
  } else {
    // 检查是否需要更新 pendingAction
    // ... 防重复逻辑 ...
  }
}
```

**改动位置 2**：`resumeConversation` 函数（第 211-222 行）

**改动内容**：
- 移除手动清除 pendingAction 的逻辑
- 让后端通过 `state_update` 事件统一管理

**改动前**：
```typescript
// 清除当前消息的 pendingAction（如果存在）
const currentMessage = agent.state.messages
  .filter(m => m.role === "assistant")
  .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

if (currentMessage?.pendingAction) {
  agent.updateMessage(currentMessage.id, {
    pendingAction: undefined,
  });
}
```

**改动后**：
```typescript
// 不再手动清除 pendingAction，让后端通过 state_update 事件统一管理
```

**效果**：状态管理统一，避免前后端状态不一致

---

### 3. 优化 AgentEngine 的拒绝处理 (`engine.ts`)

**改动位置**：`resumeConversation` 函数的拒绝分支（第 131-171 行）

**改动内容**：
1. 添加 tool 消息标记操作失败
2. **新增**：如果用户提供了拒绝理由（新消息），添加为用户消息
3. 更新迭代状态
4. **新增**：清除 state.pendingAction
5. **新增**：发送明确的 state_update 事件，清除前端 pendingAction

**改动前**：
```typescript
if (!approved) {
  if (state.pendingAction) {
    // 添加 tool 消息
    state.messages.push(toolMessage);
    
    // 更新迭代状态
    // ...
    
    yield {
      type: "state_update",
      data: {
        iterations: state.iterations,
        currentIteration: state.currentIteration,
      },
    };
  }
  
  state.pendingAction = undefined;
  yield* this.executeConversationLoop(state);
}
```

**改动后**：
```typescript
if (!approved) {
  if (state.pendingAction) {
    // 1. 添加 tool 消息（标记操作失败）
    state.messages.push(toolMessage);
    
    // 2. 如果用户提供了拒绝理由（新消息），添加为用户消息
    if (reason && reason !== "用户拒绝了此操作") {
      state.messages.push({ role: "user", content: reason });
    }
    
    // 3. 更新迭代状态
    // ...
    
    // 4. 清除 pendingAction
    state.pendingAction = undefined;
    
    // 5. 发送状态更新（明确清除前端 pendingAction）
    yield {
      type: "state_update",
      data: {
        iterations: state.iterations,
        currentIteration: state.currentIteration,
        pendingAction: undefined, // 明确清除
      },
    };
  }
  
  yield* this.executeConversationLoop(state);
}
```

**效果**：
- AI 可以看到用户的新消息作为对话的一部分
- 前端通过 state_update 事件正确清除 pendingAction
- 对话历史记录完整（包含拒绝信息和用户新消息）

---

### 4. 简化确认/拒绝按钮处理 (`chat-message.tsx`)

**改动位置**：`handleConfirmAction` 和 `handleCancelAction` 函数（第 75-123 行）

**改动内容**：
- 移除手动清除 pendingAction 的代码
- 依赖后端返回的状态更新事件

**改动前**：
```typescript
// 立即更新UI：清除pendingAction
agent.updateMessage(message.id, {
  pendingAction: undefined,
});
```

**改动后**：
```typescript
// pendingAction 的清除由后端通过 state_update 事件管理
```

**效果**：代码更简洁，状态管理更统一

---

## 数据流图

```
用户发送新消息（有 pendingAction）
    ↓
agent-panel.tsx: 检测到 pendingAction
    ↓
同步调用 resumeConversation(id, false, reason)
    ↓
use-agent-stream.tsx: 发送 API 请求
    ↓
engine.ts: resumeConversation (approved=false)
    ↓
加载对话状态（含 pendingAction）
    ↓
添加 tool 消息（标记失败）
    ↓
添加 user 消息（拒绝理由）
    ↓
清除 state.pendingAction
    ↓
发送 state_update 事件（pendingAction: undefined）
    ↓
use-agent-stream.tsx: 接收事件，更新前端状态
    ↓
继续 executeConversationLoop
    ↓
AI 根据拒绝理由和新消息生成回复
```

## 关键改进

1. **消除并发**：用户发送消息时同步等待 resumeConversation 完成
2. **状态统一**：所有 pendingAction 清除都通过后端状态更新事件
3. **逻辑简化**：拒绝消息 = tool 消息（标记失败）+ 用户消息（新输入）
4. **更好的用户体验**：用户的新消息成为对话的一部分，AI 可以根据它调整回答

## 测试场景

### 场景 1：点击"拒绝"按钮
1. Agent 显示 pendingAction 确认界面
2. 用户点击"拒绝"按钮
3. 预期结果：
   - pendingAction 被清除
   - AI 收到拒绝消息，提供替代方案
   - 不会出现并发对话流
   - UI 状态正确更新

### 场景 2：发送新消息拒绝
1. Agent 显示 pendingAction 确认界面
2. 用户在输入框输入新消息并发送
3. 预期结果：
   - pendingAction 被清除
   - AI 收到拒绝消息和用户的新消息
   - AI 根据新消息内容回复
   - 不会创建新对话
   - 不会出现并发对话流
   - UI 状态正确更新

### 场景 3：点击"确认"按钮
1. Agent 显示 pendingAction 确认界面
2. 用户点击"确认"按钮
3. 预期结果：
   - pendingAction 被清除
   - AI 执行操作
   - 操作完成后继续对话
   - UI 状态正确更新

## 修改的文件

1. `src/components/projects/editor/agent-panel/agent-panel.tsx`
2. `src/components/projects/editor/agent-panel/use-agent-stream.tsx`
3. `src/lib/services/agent-engine/engine.ts`
4. `src/components/projects/editor/agent-panel/chat-message.tsx`

## 注意事项

1. 所有 pendingAction 的清除现在都由后端通过 `state_update` 事件管理
2. 前端不再手动清除 pendingAction，避免状态不一致
3. 用户发送新消息拒绝时，新消息会作为 user 消息添加到对话历史
4. 拒绝理由格式：`用户拒绝了操作并回复：${userMessage}`

## 验证清单

- [x] 代码修改完成
- [x] Linter 错误修复
- [ ] 场景 1 测试（点击拒绝按钮）
- [ ] 场景 2 测试（发送新消息拒绝）
- [ ] 场景 3 测试（点击确认按钮）
- [ ] 检查对话历史记录是否正确
- [ ] 检查 UI 状态是否正确更新
- [ ] 检查是否存在并发冲突

