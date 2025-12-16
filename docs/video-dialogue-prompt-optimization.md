# 视频对话Prompt优化

## 优化时间
2025-12-15

## 问题诊断

用户反馈生成的视频对话有点乱，经过检查发现了以下问题：

### 1. 中英文混杂不清晰
- **原问题**：`visualDescription` 是中文，但对话格式是英文（如 "李明 says angrily"）
- **影响**：Kling API 的音频生成在处理混合语言时效果不佳

### 2. 对话格式不够优化
- **原问题**：格式为 `李明 says angrily: "我不会让你得逞的"`
- **影响**：这种格式对视频生成的音频合成不够友好，不够自然

### 3. Prompt组装过于简单
- **原问题**：所有内容（运镜、画面、对话）用逗号简单连接
- **影响**：prompt结构不清晰，容易混乱

### 4. 运镜描述语言不一致
- **原问题**：即使画面描述是中文，运镜描述也是英文（"push in"）
- **影响**：整体prompt语言不统一

## 优化方案

### 1. 双语支持系统

为所有描述元素提供中英文双语版本：

```typescript
// 情绪标签 - 中文
const emotionDescriptionsCN: Record<EmotionTag, string> = {
  neutral: "平静地",
  happy: "开心地",
  sad: "悲伤地",
  angry: "愤怒地",
  surprised: "惊讶地",
  fearful: "恐惧地",
  disgusted: "厌恶地",
};

// 运镜描述 - 中文
const cameraMovementCN: Record<CameraMovement, string> = {
  static: "固定镜头",
  push_in: "推镜头",
  pull_out: "拉镜头",
  // ... 等等
};
```

### 2. 自动语言检测

根据 `visualDescription` 是否存在来判断使用中文还是英文：

```typescript
const isChinesePrompt = !!visualDescription;
```

### 3. 优化对话格式

#### 中文格式（更自然）
- 有角色+有情绪：`李明愤怒地说："我不会让你得逞的"`
- 有角色+无情绪：`李明说："我不会让你得逞的"`
- 旁白+有情绪：`旁白悲伤地："他离开了"`
- 旁白+无情绪：`旁白："他离开了"`

#### 英文格式（更专业）
- 有角色+有情绪：`Li Ming says angrily, "I won't let you succeed"`
- 有角色+无情绪：`Li Ming says, "I won't let you succeed"`
- 旁白+有情绪：`Narration sadly, "He left"`
- 旁白+无情绪：`Narration, "He left"`

### 4. 结构化Prompt组装

不再使用逗号简单连接，而是：
- **中文模式**：使用句号 `。` 连接各部分
- **英文模式**：使用句点加空格 `. ` 连接各部分
- **多对话**：使用分号 `；` 分隔，更清晰

## 优化效果对比

### 优化前（中英混杂，格式混乱）
```
push in, 李明站在办公室门口，双拳紧握，眉头紧锁, 李明 says angrily: "我不会让你得逞的", 张伟 says sadly: "你为什么不相信我"
```

### 优化后（语言统一，结构清晰）

**中文版本：**
```
推镜头。李明站在办公室门口，双拳紧握，眉头紧锁。李明愤怒地说："我不会让你得逞的"；张伟悲伤地说："你为什么不相信我"
```

**英文版本：**
```
push in. Chinese man Li Ming standing at office door, fists clenched, brows furrowed, tense expression. Li Ming says angrily, "I won't let you succeed"; Zhang Wei says sadly, "Why don't you trust me"
```

## 技术实现

### 修改文件
`src/lib/utils/motion-prompt.ts`

### 关键改动

1. **新增双语映射表**
   - `emotionDescriptionsCN` / `emotionDescriptionsEN`
   - `cameraMovementCN` / `cameraMovementEN`

2. **更新 `generateMotionPrompt` 函数**
   - 新增 `isChinese` 参数
   - 根据语言选择对应的映射表

3. **优化 `buildVideoPrompt` 函数**
   - 自动检测语言
   - 统一各部分的语言风格
   - 优化对话格式
   - 改进prompt连接方式

## 预期效果

1. **音频生成更准确**：语言统一后，Kling API 能更好地生成对应的音频
2. **对话表达更自然**：中文对话使用符合中文习惯的表达方式
3. **Prompt更清晰**：结构化的组装方式让prompt逻辑更清楚
4. **国际化支持**：为未来支持多语言打下基础

## 测试建议

### 测试场景

1. **纯中文场景**
   - 中文画面描述 + 中文对话
   - 验证音频生成是否自然

2. **纯英文场景**
   - 英文画面描述 + 英文对话
   - 验证音频生成是否准确

3. **多对话场景**
   - 多个角色对话
   - 验证对话分隔是否清晰

4. **情绪表达场景**
   - 不同情绪标签的对话
   - 验证情绪描述是否恰当

### 测试方法

1. 在分镜编辑器中生成视频
2. 检查生成的prompt内容（可在日志中查看）
3. 观察视频音频效果
4. 对比优化前后的差异

## 兼容性说明

- ✅ 向后兼容：`generateMotionPrompt` 的 `isChinese` 参数默认为 `false`
- ✅ 无需迁移：现有代码无需修改即可继续工作
- ✅ 渐进增强：新功能自动生效，无需手动配置

## 后续优化建议

1. **增加更多情绪描述**
   - 考虑添加更细腻的情绪标签（如 contempt、anxious、hopeful 等）
   - 在类型定义中扩展 `EmotionTag`

2. **支持音效描述**
   - 在prompt中加入音效提示
   - 如背景音乐、环境音等

3. **优化运镜+对话的协同**
   - 某些运镜配合对话时的特殊处理
   - 如推镜头配合情绪升级等

4. **A/B测试**
   - 收集用户反馈
   - 对比不同格式的生成效果
   - 持续优化prompt模板

