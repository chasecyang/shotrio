# 待批准状态刷新修复 - 测试指南

本文档描述了如何测试刷新页面后待批准状态恢复的功能。

## 修复内容概述

修复了当 Agent 有 function 待用户批准时，刷新页面后待批准状态消失并卡住的 bug。

### 修改的文件

1. **src/lib/services/agent-engine/state-manager.ts**
   - 新增 `derivePendingActionFromMessages` 异步函数，支持从 AgentMessage 格式推导 pendingAction
   - 支持重新计算积分成本
   - 增强日志记录

2. **src/lib/actions/conversation/crud.ts**
   - 在 `getConversation` 中添加 pendingAction 推导逻辑
   - 自动修复状态不一致（awaiting_approval 但无 pendingAction）

3. **src/lib/services/agent-engine/engine.ts**
   - 在 `resumeConversation` 中添加状态一致性验证
   - 防止状态不一致导致的错误

## 测试场景

### 场景 1: 刷新页面后恢复待批准状态

**测试步骤：**

1. 启动开发服务器：`npm run dev`
2. 登录并进入项目编辑器
3. 打开 Agent 对话面板
4. 发送一条会触发需要确认的 function 的消息，例如：
   - "生成 3 个角色素材：主角、配角、反派"
   - "创建 5 个分镜"
   - "删除当前剧集的所有分镜"
5. 等待 Agent 响应，应该看到待批准的 UI（确认/拒绝按钮）
6. **不要点击任何按钮**，直接刷新页面（F5 或 Cmd+R）
7. 页面重新加载后，检查对话历史

**预期结果：**
- ✅ 待批准的 UI 重新显示
- ✅ 可以看到待执行的 function 名称和参数
- ✅ 显示估算的积分成本
- ✅ 确认和拒绝按钮都可点击

**验证日志：**
打开浏览器控制台，应该看到以下日志：
```
[getConversation] 对话状态: awaiting_approval 消息数量: X
[derivePendingAction] 成功推导 pendingAction: {...}
[getConversation] pendingAction 已附加到消息: msg_xxx
```

---

### 场景 2: 刷新后确认操作

**前置条件：**
- 完成场景 1，页面已刷新，待批准 UI 已恢复

**测试步骤：**

1. 在刷新后的页面上，点击"确认"按钮
2. 观察 Agent 的响应

**预期结果：**
- ✅ Function 正常执行
- ✅ 对话继续，Agent 给出执行结果的反馈
- ✅ 对话状态更新为 `active` 或 `completed`
- ✅ 如果是生成任务，任务面板显示新的任务

**验证日志：**
```
[AgentEngine] 恢复对话: conv_xxx, 批准: true
[AgentEngine] 对话状态: awaiting_approval, pendingAction: 存在
[AgentEngine] 执行工具: xxx
```

---

### 场景 3: 刷新后拒绝操作

**前置条件：**
- 重复场景 1 的步骤 1-6

**测试步骤：**

1. 在刷新后的页面上，点击"拒绝"按钮
2. 观察 Agent 的响应

**预期结果：**
- ✅ Agent 收到拒绝消息
- ✅ Agent 给出替代方案或询问下一步
- ✅ 对话继续进行
- ✅ Function 未被执行

**验证日志：**
```
[AgentEngine] 恢复对话: conv_xxx, 批准: false
[AgentEngine] 为 1 个 tool_calls 添加拒绝消息
```

---

### 场景 4: 对话状态不一致自动修复

**测试步骤：**

此场景需要手动模拟状态不一致，使用数据库客户端或 API：

1. 创建一个正常的对话
2. 通过数据库或 API 将对话状态修改为 `awaiting_approval`，但不创建相应的待确认操作
3. 刷新页面或加载该对话

**预期结果：**
- ✅ 系统检测到状态不一致
- ✅ 自动将对话状态修复为 `active`
- ✅ 不会显示待批准 UI
- ✅ 用户可以正常继续对话

**验证日志：**
```
[getConversation] 对话状态为 awaiting_approval，但无法推导 pendingAction，可能是状态不一致
[getConversation] 尝试自动修复对话状态为 active
```

或在恢复对话时：
```
[AgentEngine] 检测到状态不一致：awaiting_approval 但无 pendingAction，自动修复为 active
```

---

### 场景 5: 积分成本重新计算

**测试步骤：**

1. 执行场景 1 的步骤 1-6
2. 刷新页面后，检查待批准 UI 中显示的积分成本

**预期结果：**
- ✅ 积分成本正确显示
- ✅ 积分成本与刷新前一致
- ✅ 如果积分余额不足，显示警告

**技术细节：**
- `derivePendingActionFromMessages` 函数会重新调用 `estimateActionCredits`
- 确保积分估算是实时的，不依赖缓存的值

---

## 回归测试

确保修复没有破坏现有功能：

### 测试 1: 正常流程（不刷新）

1. 触发需要确认的操作
2. 立即点击确认（不刷新）
3. 验证 function 正常执行

### 测试 2: 不需要确认的操作

1. 触发不需要确认的操作（如查询）
2. 验证直接执行，不显示待批准 UI

### 测试 3: 新对话创建

1. 创建新对话
2. 发送消息
3. 验证对话正常初始化

---

## 错误处理测试

### 测试 1: 无效的对话 ID

1. 尝试加载不存在的对话
2. 预期：显示错误消息

### 测试 2: 权限验证

1. 尝试访问其他用户的对话
2. 预期：返回未授权错误

---

## 性能验证

### 验证点：

1. **加载时间**
   - 刷新后加载对话的时间应在可接受范围内（< 1 秒）
   - `derivePendingActionFromMessages` 不应显著增加加载时间

2. **数据库查询**
   - 不应有重复的查询
   - 状态修复操作应最小化

3. **日志量**
   - 日志应该有帮助但不过多
   - 生产环境可以调整日志级别

---

## 已知限制

1. **creditCost 可能与原值略有差异**
   - 因为是重新计算的，如果定价规则有变化，可能会不同
   - 这是预期行为，以最新的定价为准

2. **旧对话的兼容性**
   - 修复前创建的卡住的对话可能需要手动修复状态
   - 建议清理或归档这些对话

---

## 调试技巧

### 查看详细日志

在浏览器控制台过滤日志：
```javascript
// 只看 Agent 相关日志
console.log = new Proxy(console.log, {
  apply: function(target, thisArg, args) {
    if (args[0]?.includes?.('[Agent') || args[0]?.includes?.('[derive')) {
      target.apply(thisArg, args);
    }
  }
});
```

### 检查对话状态

在浏览器控制台执行：
```javascript
// 假设你在 Agent 面板中
const agent = window.__agentContext; // 如果暴露了的话
console.log('Current conversation:', agent.state.currentConversationId);
console.log('Messages:', agent.state.messages);
```

### 手动触发状态恢复

如果需要手动测试状态恢复逻辑，可以：
1. 在 `getConversation` 函数中设置断点
2. 观察 `derivePendingActionFromMessages` 的执行
3. 检查返回的 `pendingAction` 对象

---

## 测试完成标准

所有以上场景都应该通过，包括：
- ✅ 场景 1: 刷新页面后恢复待批准状态
- ✅ 场景 2: 刷新后确认操作
- ✅ 场景 3: 刷新后拒绝操作
- ✅ 场景 4: 对话状态不一致自动修复
- ✅ 场景 5: 积分成本重新计算
- ✅ 所有回归测试通过
- ✅ 错误处理正确
- ✅ 性能可接受

---

## 反馈和报告

如果发现问题，请记录：
1. 场景编号
2. 实际结果 vs 预期结果
3. 浏览器控制台日志
4. 网络请求日志（如果相关）
5. 复现步骤

提交问题时附带这些信息以便快速定位和修复。

