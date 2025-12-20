# Agent 中断功能

## 概述

用户现在可以在 Agent 生成过程中点击停止按钮来中断 AI 的输出，立即停止对话流和后续的工具调用。

## 功能特性

### 1. 动态按钮状态
- **正常状态**：显示发送图标（Send），用于发送新消息
- **处理中状态**：按钮变为红色停止按钮（Square 图标），点击可中断
- **禁用状态**：输入框为空且未处理时禁用

### 2. 中断机制
- 使用浏览器原生的 `AbortController` API
- 点击停止按钮会立即终止 HTTP 流式请求
- 服务器端的流会因连接断开而自动清理
- 中断后用户可以立即发送新消息

### 3. 视觉反馈
- 中断按钮使用 `destructive` 变体（红色）
- 中断后的消息显示"✋ 已中断"标记
- 显示 toast 提示："已停止 AI 生成"
- 输入框下方提示文本动态变化

### 4. 已创建的任务不受影响
- 中断只停止 AI 对话流
- 已经创建的 Job 任务会继续在后台运行
- Worker 会正常处理这些任务

## 技术实现

### 修改的文件

1. **src/types/agent.ts**
   - 在 `AgentMessage` 接口中添加 `isInterrupted?: boolean` 字段

2. **src/components/projects/editor/agent-panel/agent-panel.tsx**
   - 添加 `abortControllerRef` 引用
   - 添加 `handleStop()` 函数
   - 修改 `handleSend()` 和 `resumeConversation()`，支持 AbortSignal
   - 更新发送按钮的 UI 和交互逻辑
   - 处理 AbortError 异常

3. **src/components/projects/editor/agent-panel/chat-message.tsx**
   - 添加中断状态的视觉标记
   - 显示"已中断"图标和文本

### 核心代码逻辑

```typescript
// 创建 AbortController
abortControllerRef.current = new AbortController();

// 传递 signal 给 fetch
const response = await fetch("/api/agent/chat-stream", {
  signal: abortControllerRef.current.signal,
  // ...
});

// 用户点击停止
const handleStop = () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
};

// 捕获中断异常
catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    // 处理中断
    agent.updateMessage(tempMsgId, {
      isStreaming: false,
      isInterrupted: true,
    });
  }
}
```

## 用户体验

### 正常流程
1. 用户输入消息并点击发送
2. 发送按钮变为红色停止按钮
3. AI 开始流式输出内容
4. 完成后按钮恢复为发送状态

### 中断流程
1. 用户在 AI 输出过程中点击停止按钮
2. 流式输出立即停止
3. 消息末尾显示"已中断"标记
4. 显示 toast 提示
5. 按钮恢复为发送状态
6. 用户可以继续发送新消息

## 兼容性

- ✅ 前后端无需额外配置
- ✅ 与现有对话历史兼容
- ✅ 已创建的 Job 不受影响
- ✅ 移动端和桌面端一致体验

## 测试建议

1. 发送消息后立即点击停止，验证输出停止
2. 中断后发送新消息，验证功能正常
3. 检查已创建的生成任务继续运行
4. 验证中断消息在历史记录中正确显示
5. 测试移动端交互体验
6. 测试恢复对话时的中断功能

## 注意事项

- 中断只影响当前的对话流，不会取消已创建的 Job
- 如果需要取消 Job，请使用任务管理界面的取消功能
- AbortController 是浏览器标准 API，所有现代浏览器都支持

