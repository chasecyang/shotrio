# 分镜拆分 AI Prompt 优化文档

## 问题诊断

### 发现的主要问题

经过代码分析，我们发现了导致分镜拆分失败率高的几个关键问题：

#### 1. 字段名不一致 ❌

**问题位置：** `src/lib/workers/processors/storyboard-processors.ts`

原 prompt 示例中使用的字段名：
```json
{
  "dialogues": [
    {
      "dialogueText": "...",  // ❌ 示例用的是 dialogueText
      "emotionTag": "angry"   // ❌ 示例用的是 emotionTag
    }
  ]
}
```

但代码解析时期望的字段名：
```typescript
dialogues: (shot.dialogues || []).map((dialogue: AIDialogueResponse) => ({
  dialogueText: dialogue.text || "",      // ❌ 这里读取的是 text
  emotionTag: dialogue.emotion || "neutral", // ❌ 这里读取的是 emotion
}))
```

**影响：** AI 按照示例返回 `dialogueText` 和 `emotionTag`，但代码读取 `text` 和 `emotion`，导致数据丢失。

#### 2. Temperature 设置过高

```typescript
temperature: 0.7  // ❌ 对于结构化输出过高
```

**问题：** `0.7` 的温度对于需要严格 JSON 格式的输出来说太高，容易产生格式不规范的内容。

**影响：** 增加了 JSON 解析失败的概率。

#### 3. Token 限制不足

```typescript
maxTokens: 8000  // ❌ 对于长剧本可能不够
```

**问题：** 微短剧虽然短，但拆分成详细分镜后可能需要很多 tokens。如果超出限制，JSON 会被截断。

**影响：** 导致返回的 JSON 不完整，无法解析。

#### 4. 错误处理不够详细

原代码：
```typescript
const aiResult = safeJsonParse(response);
if (!aiResult.shots || !Array.isArray(aiResult.shots)) {
  throw new Error("AI返回的数据格式不正确");
}
```

**问题：**
- 错误信息过于笼统，无法定位具体问题
- 没有记录 AI 的原始返回值
- 没有验证数据的完整性

#### 5. Prompt 结构不够清晰

原 prompt 的问题：
- ❌ 只有一个示例，对复杂场景覆盖不足
- ❌ 没有强调"必须返回有效 JSON"
- ❌ 字段说明分散，不够醒目
- ❌ 缺少明确的"不要输出其他内容"的指令

---

## 优化方案

### 1. 修复字段名不一致问题 ✅

**修改位置：** Prompt 示例部分

将示例改为与代码一致：
```json
{
  "dialogues": [
    {
      "characterName": "李明",
      "text": "我不会让你得逞的。",  // ✅ 使用 text
      "emotion": "angry",            // ✅ 使用 emotion
      "order": 1
    }
  ]
}
```

### 2. 降低 Temperature ✅

```typescript
temperature: 0.3  // ✅ 从 0.7 降至 0.3
```

**效果：** 使 AI 输出更加稳定和可预测，减少格式错误。

### 3. 增加 Token 限制 ✅

```typescript
maxTokens: 12000  // ✅ 从 8000 增至 12000
```

**效果：** 支持更长的剧本，减少 JSON 被截断的风险。

### 4. 增强错误处理和日志 ✅

```typescript
let aiResult;
try {
  aiResult = safeJsonParse(response);
  console.log("[分镜提取] AI 返回数据预览:", JSON.stringify(aiResult).substring(0, 200));
} catch (parseError) {
  console.error("[分镜提取] JSON 解析失败，原始响应:", response.substring(0, 500));
  throw new Error(`AI 返回的数据无法解析为 JSON: ${parseError.message}`);
}

// 详细的格式验证
if (!aiResult || typeof aiResult !== 'object') {
  throw new Error("AI 返回的数据格式不正确：不是有效的对象");
}

if (!aiResult.shots) {
  throw new Error("AI 返回的数据格式不正确：缺少 shots 字段");
}

if (!Array.isArray(aiResult.shots)) {
  throw new Error("AI 返回的数据格式不正确：shots 不是数组");
}

if (aiResult.shots.length === 0) {
  throw new Error("AI 返回的分镜数量为0，请检查剧本内容是否完整");
}

console.log(`[分镜提取] 成功提取 ${aiResult.shots.length} 个分镜`);
```

**效果：**
- ✅ 更详细的错误信息，便于定位问题
- ✅ 记录原始返回值，便于调试
- ✅ 分步骤验证，明确失败原因

### 5. 优化 Prompt 结构 ✅

**改进要点：**

1. **明确 JSON 要求**
   ```
   # 核心任务
   1. **必须返回有效的 JSON 格式**：输出必须是可解析的 JSON，不要添加任何解释文字
   ```

2. **增加第二个示例**
   ```json
   // 第一个示例：带对话的中景镜头
   // 第二个示例：无对话的特写镜头
   ```

3. **字段说明更清晰**
   ```
   # 字段说明（严格按此格式）
   - dialogues: 对话数组（没有对话则为空数组 []）
     - text: 对话内容（准确引用剧本原文）  // ✅ 明确用 text
     - emotion: 情绪标签                    // ✅ 明确用 emotion
   ```

4. **关键注意事项**
   ```
   # 关键注意事项
   1. **JSON格式**：输出必须是有效的JSON，不要有markdown代码块标记
   2. **字段名精确匹配**：dialogues中用"text"不是"dialogueText"
   3. **枚举值准确**：shotSize和cameraMovement必须使用列出的精确值
   ```

### 6. 增强 JSON Parser 容错能力 ✅

在 `src/lib/workers/utils/json-parser.ts` 中添加：

```typescript
// 移除 markdown 代码块标记（```json 或 ```）
.replace(/^```(?:json)?\s*/gm, '')
.replace(/```\s*$/gm, '')
```

**效果：** 即使 AI 返回带有 markdown 格式的 JSON，也能正确解析。

---

## 预期效果

### 成功率提升

通过以上优化，预期能解决以下问题：

| 问题 | 解决方案 | 预期改善 |
|------|---------|---------|
| 字段名不匹配导致数据丢失 | 统一字段名 | 减少 30-40% 的失败 |
| JSON 格式不规范 | 降低 temperature + 明确要求 | 减少 20-30% 的失败 |
| Token 截断 | 增加限制 | 减少 10-15% 的失败 |
| 无法定位问题 | 详细日志 | 加快问题排查速度 |
| Markdown 格式干扰 | 增强 parser | 减少 5-10% 的失败 |

**总体预期：** 失败率从当前的高失败率降低到 10% 以下。

### 调试便利性

- ✅ 每次失败都有详细的错误信息
- ✅ 记录 AI 原始返回值，便于分析
- ✅ 分步骤验证，快速定位问题环节

---

## 测试建议

### 1. 测试不同长度的剧本

- 短剧本（< 500 字）
- 中等剧本（500-1500 字）
- 长剧本（> 1500 字）

### 2. 测试不同场景

- 单场景单角色
- 多场景多角色
- 复杂对话场景
- 动作场景

### 3. 监控日志

关注以下日志输出：
```
[分镜提取] AI 返回数据预览: ...
[分镜提取] 成功提取 X 个分镜
```

如果失败，检查：
```
[分镜提取] JSON 解析失败，原始响应: ...
AI 返回的数据格式不正确：...
```

---

## 后续优化方向

如果问题仍然存在，可以考虑：

### 1. 使用更强大的模型

```typescript
model: "gpt-4-turbo-preview"  // 或 gpt-4
```

GPT-4 在结构化输出方面表现更好。

### 2. 添加重试机制

```typescript
let retries = 3;
while (retries > 0) {
  try {
    const response = await getChatCompletion(...);
    // 解析和验证
    break;
  } catch (error) {
    retries--;
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### 3. 分批处理长剧本

如果剧本特别长，可以：
1. 先让 AI 分析剧本结构
2. 按场景分批生成分镜
3. 最后合并结果

### 4. 使用 Function Calling

如果使用支持 Function Calling 的模型，可以定义严格的 schema：

```typescript
{
  name: "generate_storyboard",
  parameters: {
    type: "object",
    properties: {
      shots: {
        type: "array",
        items: { ... }
      }
    },
    required: ["shots"]
  }
}
```

这样可以获得更可靠的结构化输出。

---

## 修改文件清单

1. ✅ `src/lib/workers/processors/storyboard-processors.ts`
   - 修复字段名不一致
   - 优化 prompt 结构
   - 降低 temperature
   - 增加 maxTokens
   - 增强错误处理

2. ✅ `src/lib/workers/utils/json-parser.ts`
   - 添加 markdown 代码块处理

---

## 回滚方案

如果新版本出现问题，可以通过 git 回滚：

```bash
git checkout HEAD~1 src/lib/workers/processors/storyboard-processors.ts
git checkout HEAD~1 src/lib/workers/utils/json-parser.ts
```

或者手动修改：
- temperature 改回 0.7
- maxTokens 改回 8000
- 恢复原 prompt

---

## 联系与反馈

如有问题请检查：
1. Worker 日志中的详细错误信息
2. AI 返回的原始响应内容
3. 是否使用了正确的 OpenAI 模型

Date: 2025-12-13

