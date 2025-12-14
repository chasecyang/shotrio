# DeepSeek Reasoning 模式集成文档

## 概述

本次改造将项目中适合深度思考的 LLM 调用场景改造为使用 DeepSeek 的 reasoning 模式，以获得更准确、更高质量的结果。

## 什么是 Reasoning 模式？

DeepSeek 的 reasoning 模式在输出最终回答之前，会先输出一段思维链内容（reasoning content），通过深度思考来提升最终答案的准确性。这特别适合需要：

- 深度分析和理解的任务
- 复杂的结构化输出
- 需要推理和判断的场景
- 创意性内容生成

## 改造内容

### 1. OpenAI 服务层扩展

**文件**: `src/lib/services/openai.service.ts`

**改动**:
- 在 `ChatCompletionOptions` 接口中添加 `useReasoning` 参数
- 在 `getChatCompletion` 函数中支持 reasoning 模式：
  - 当 `useReasoning: true` 时，添加 `thinking: { type: "enabled" }` 参数
  - 自动调整 `max_tokens` 至少为 32K（reasoning 模式推荐值）
  - 在 reasoning 模式下不设置 `temperature`（该参数不被支持）

**代码示例**:
```typescript
const response = await getChatCompletion(
  messages,
  {
    maxTokens: 32000,
    jsonMode: true,
    useReasoning: true, // 启用 reasoning 模式
  }
);
```

### 2. 分镜生成处理器

**文件**: `src/lib/workers/processors/storyboard-processors.ts`

**适用场景**: `processStoryboardBasicExtraction`

**为什么适合 reasoning**:
- 需要深入分析剧本的故事结构和情节发展
- 需要理解镜头语言和电影叙事逻辑
- 需要生成复杂的结构化 JSON 输出
- 需要判断合适的景别、运镜方式和时长

**改动**:
- 启用 `useReasoning: true`
- 将 `maxTokens` 从 12000 提升到 32000

**预期效果**:
- 更准确的镜头切换逻辑
- 更合理的景别和运镜选择
- 更符合电影叙事规律的分镜序列

### 3. 角色提取处理器

**文件**: `src/lib/workers/processors/character-extraction.ts`

**适用场景**: `processCharacterExtraction`

**为什么适合 reasoning**:
- 需要理解角色的性格特征和行为模式
- 需要识别角色在不同场景下的造型变化
- 需要生成专业的英文图像生成 prompt
- 需要推理角色的外貌特征

**改动**:
- 启用 `useReasoning: true`
- 将 `maxTokens` 从 6000 提升到 32000

**预期效果**:
- 更准确的角色性格描述
- 更专业的图像生成 prompt
- 更合理的造型分类

### 4. 场景提取处理器

**文件**: `src/lib/workers/processors/scene-extraction.ts`

**适用场景**: `processSceneExtraction`

**为什么适合 reasoning**:
- 需要理解场景的空间布局和视觉特征
- 需要识别和归类相同地点
- 需要生成适合 AI 图像生成的场景描述
- 需要避免将情节细节混入场景描述

**改动**:
- 启用 `useReasoning: true`
- 将 `maxTokens` 从 4000 提升到 32000

**预期效果**:
- 更准确的场景识别和归类
- 更符合图像生成需求的场景描述
- 更好地区分场景的固定元素和临时元素

### 5. 角色造型 Prompt 生成

**文件**: `src/lib/actions/character/prompt-generation.ts`

**适用场景**: `generateStylePrompt`

**为什么适合 reasoning**:
- 需要理解简单中文描述的意图
- 需要转换为专业的英文 AI 绘图 prompt
- 需要区分固定特征和可变元素
- 需要掌握 Stable Diffusion 等工具的 prompt 规范

**改动**:
- 启用 `useReasoning: true`
- 将 `maxTokens` 从 500 提升到 2000

**预期效果**:
- 更专业的英文 prompt
- 更好地理解用户意图
- 更符合 AI 绘图工具规范的描述

## Reasoning 模式的限制

根据 DeepSeek 官方文档，reasoning 模式有以下限制：

### 不支持的参数
- `temperature`
- `top_p`
- `presence_penalty`
- `frequency_penalty`
- `logprobs`
- `top_logprobs`

### 支持的功能
- ✅ JSON Output
- ✅ Tool Calls（需要特殊处理）
- ✅ 对话补全
- ✅ 对话前缀续写 (Beta)
- ❌ FIM 补全 (Beta)

### 推荐配置
- `max_tokens`: 32K 或 64K（默认 32K）
- 模型: `deepseek-reasoner` 或配合 `thinking: { type: "enabled" }`

## 使用建议

### 1. 环境变量配置

确保在环境变量中配置了正确的 DeepSeek API：

```env
OPENAI_API_KEY=your_deepseek_api_key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat  # 或 deepseek-reasoner
```

### 2. 监控 Token 使用

由于 reasoning 模式会生成思维链内容，token 消耗会比普通模式多。建议：

- 监控 API 调用成本
- 在非关键场景可以选择不使用 reasoning 模式
- 根据实际效果评估是否值得启用

### 3. 错误处理

reasoning 模式的响应时间可能较长，需要：

- 设置合理的超时时间
- 提供清晰的进度提示
- 处理可能的超时错误

### 4. 测试验证

改造后建议进行充分测试：

- 比较 reasoning 模式和普通模式的输出质量
- 验证 JSON 格式的正确性
- 检查生成内容的准确性和专业性

## 回退方案

如果 reasoning 模式出现问题，可以快速回退：

```typescript
// 将 useReasoning 设置为 false 即可回退到普通模式
const response = await getChatCompletion(
  messages,
  {
    temperature: 0.7,
    maxTokens: 4096,
    jsonMode: true,
    useReasoning: false, // 关闭 reasoning 模式
  }
);
```

## 预期收益

1. **更高质量的输出**: 通过深度思考，生成更准确、更专业的内容
2. **更好的结构化**: 对复杂 JSON 格式的理解更准确
3. **更强的推理能力**: 能够更好地理解剧本逻辑和角色关系
4. **更专业的 Prompt**: 生成更符合 AI 绘图工具规范的提示词

## 参考文档

- [DeepSeek API 文档 - 思考模式](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode)
- DeepSeek API 官方文档

## 更新日志

### 2025-01-XX
- 初始版本：为 5 个关键场景启用 reasoning 模式
- 扩展 OpenAI 服务层支持 reasoning 参数
- 更新相关处理器和 action

## 注意事项

1. 本次改造保持了向后兼容性，默认情况下不使用 reasoning 模式
2. 只有在明确指定 `useReasoning: true` 时才会启用
3. 所有改造都经过 TypeScript 类型检查，无编译错误
4. 改造不影响现有的普通 LLM 调用场景

