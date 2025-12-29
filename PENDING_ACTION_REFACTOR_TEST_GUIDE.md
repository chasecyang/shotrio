# PendingAction 架构重构 - 测试指南

## 重构概述

本次重构将 `pendingAction` 从数据库存储改为从消息历史推导，采用 Event Sourcing 思想，简化了状态管理并提升了用户体验。

## 核心变更

1. **状态推导**：`pendingAction` 不再存储在数据库，而是通过 `derivePendingAction()` 函数从消息历史推导
2. **拒绝流程简化**：移除 `reason` 参数，拒绝操作纯粹，用户补充说明通过新消息发送
3. **自动清除 UI**：通过 `tool_call_end` 事件自动清除被拒绝的 `pendingAction` UI
4. **数据库精简**：移除 `conversation.pending_action` 字段

## 测试场景

### 场景 1：用户点击"拒绝"按钮

**测试步骤**：
1. 触发一个需要确认的操作（如创建分镜）
2. 等待 AI 显示待确认 UI
3. 点击"拒绝"按钮

**预期结果**：
- ✅ Toast 提示："操作已拒绝，Agent 正在回应..."
- ✅ 待确认 UI 消失，显示"已拒绝"标记
- ✅ AI 生成新消息："好的，我明白了。还有什么我可以帮助的吗？"
- ✅ 对话历史中有 tool message（success: false）

**验证点**：
```javascript
// 检查消息历史
const messages = agent.state.messages;
const lastToolMessage = messages.filter(m => m.role === "tool").pop();
// 应该有 { success: false, userRejected: true }
```

---

### 场景 2：用户发送新消息时自动拒绝

**测试步骤**：
1. 触发一个需要确认的操作
2. 不点击确认/拒绝按钮
3. 直接在聊天框输入新消息："不用3个，2个就够了"
4. 发送消息

**预期结果**：
- ✅ 待确认 UI 自动消失
- ✅ AI 先回应拒绝："好的，我明白了"
- ✅ 用户的新消息正常显示："不用3个，2个就够了"
- ✅ AI 根据新消息调整方案："好的，我帮你创建2个分镜..."

**关键验证**：
- 用户消息不会"消失"
- 对话历史清晰连贯
- 没有出现 "用户拒绝了操作并回复：..." 这样的混乱消息

---

### 场景 3：刷新页面后恢复状态

**测试步骤**：
1. 触发一个需要确认的操作
2. 不做任何操作，直接刷新页面（F5）
3. 观察页面加载后的状态

**预期结果**：
- ✅ 待确认 UI 正确恢复显示
- ✅ 可以正常点击确认/拒绝
- ✅ 积分估算可能需要重新计算（显示"计算中..."）

**验证点**：
```javascript
// 检查 pendingAction 是从消息推导的
// 数据库中不应该有 pending_action 字段
```

---

### 场景 4：自动执行的 Function（read 类）

**测试步骤**：
1. 发送消息："查询一下项目信息"
2. AI 调用 `query_context` 函数

**预期结果**：
- ✅ 不显示待确认 UI（因为 `needsConfirmation: false`）
- ✅ 直接执行并返回结果
- ✅ 不会误判为 pending

**验证点**：
```javascript
// 检查 derivePendingAction 逻辑
// needsConfirmation: false 的 function 不应该返回 pendingAction
```

---

### 场景 5：用户确认操作

**测试步骤**：
1. 触发一个需要确认的操作
2. 点击"确认"按钮

**预期结果**：
- ✅ Toast 提示："操作已确认，Agent 正在继续..."
- ✅ 待确认 UI 消失
- ✅ 操作正常执行
- ✅ 显示执行结果

---

### 场景 6：连续拒绝多个操作

**测试步骤**：
1. 触发操作 A，拒绝
2. AI 提供替代方案 B，再次拒绝
3. AI 提供替代方案 C

**预期结果**：
- ✅ 每次拒绝后 UI 正确清除
- ✅ 对话历史完整记录所有拒绝
- ✅ 不会出现状态混乱

---

## 数据库验证

### 检查 Schema

```sql
-- 检查 conversation 表结构
\d conversation

-- 应该看到：
-- - context 字段存在
-- - pending_action 字段不存在（已删除）
```

### 检查消息历史

```sql
-- 查看对话消息
SELECT id, role, content, tool_call_id, tool_calls 
FROM conversation_message 
WHERE conversation_id = 'your-conversation-id'
ORDER BY created_at;

-- 拒绝操作后应该看到：
-- 1. assistant 消息（带 tool_calls）
-- 2. tool 消息（success: false, userRejected: true）
-- 3. 新的 assistant 消息（AI 回应）
```

---

## 性能验证

### 数据库写入次数

**拒绝操作前**：
- 3 次写入（tool message + status + pending_action）

**拒绝操作后**：
- 2 次写入（tool message + status）

**改进**：减少 33% 数据库写入

---

## 边界情况测试

### 1. 网络中断
- 拒绝操作时网络断开
- 预期：前端显示错误，不会出现幽灵状态

### 2. 并发操作
- 同时触发多个需要确认的操作
- 预期：每个操作独立管理，不会互相干扰

### 3. 旧数据兼容
- 数据库中有旧的 `pending_action` 数据
- 预期：迁移后自动失效，从消息推导

---

## 回滚方案

如果发现问题需要回滚：

1. **恢复数据库字段**：
```sql
ALTER TABLE "conversation" ADD COLUMN "pending_action" TEXT;
```

2. **恢复代码**：
```bash
git revert <commit-hash>
```

3. **重新部署**

---

## 成功标准

- ✅ 所有测试场景通过
- ✅ 用户体验流畅，无卡顿
- ✅ 对话历史清晰，无混乱消息
- ✅ 刷新页面状态正确恢复
- ✅ 无 linter 错误
- ✅ 数据库写入次数减少

---

## 已完成的改动

### 后端
- ✅ 添加 `derivePendingAction()` 状态推导函数
- ✅ 修改 `loadConversationState()` 使用推导逻辑
- ✅ 简化 `resumeConversation()` 签名（移除 reason 参数）
- ✅ 移除 `saveConversationState()` 中保存 pendingAction 的逻辑
- ✅ 移除 `executeConversationLoop()` 中调用 `saveConversationState()`

### 前端
- ✅ 简化 `handleCancelAction()`（不传 reason）
- ✅ 修改 `handleSend()` 自动拒绝逻辑（不 return，继续发送消息）
- ✅ 添加 `tool_call_end` 事件处理清除 pendingAction UI

### 数据库
- ✅ 创建迁移文件 `0004_remove_pending_action.sql`
- ✅ 更新 schema 定义（移除 pendingAction 字段）
- ✅ 添加类型注释说明 pendingAction 不持久化

---

## 注意事项

1. **数据库迁移**：需要在生产环境执行迁移 SQL
2. **旧数据**：迁移会删除所有旧的 pending_action 数据，但不影响功能
3. **积分计算**：刷新页面后 creditCost 需要重新计算
4. **监控**：上线后监控错误日志，特别是 `derivePendingAction` 相关

---

## 联系方式

如有问题，请查看：
- 计划文档：`.cursor/plans/优化_pendingaction_架构_5ca26b87.plan.md`
- 代码改动：查看 git commit 历史

