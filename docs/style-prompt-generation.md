# 造型描述AI生成功能

## 功能概述

为角色造型描述添加AI智能生成和优化功能，降低用户使用门槛，提升prompt质量。

## 实现日期

2024-12-08

## 功能特性

### 1. 智能模式切换

- **生成模式**：当造型描述为空或只有简单内容时，点击AI按钮会基于造型名称和角色信息生成专业的英文prompt
- **优化模式**：当已有描述时，点击AI按钮会优化现有内容，使其更专业、更适合AI绘图

### 2. 交互设计

参考剧本AI优化功能的交互模式：

- 点击紫色Sparkles按钮触发AI生成
- AI结果显示在紫色预览卡片中
- 提供"接受"和"拒绝"两个操作按钮
- 接受后自动替换原内容并触发保存
- 拒绝后清除建议，保持原内容不变

### 3. 视觉反馈

- 生成过程中按钮显示Loading动画
- 成功后显示toast提示
- 失败时显示错误信息
- 预览卡片使用紫色主题，与AI功能保持一致

## 技术实现

### Server Actions

**文件**: `src/lib/actions/character/prompt-generation.ts`

#### `generateStylePrompt(params)`

核心函数，支持两种模式：

- **generate模式**：基于角色信息和简单描述生成新prompt
- **optimize模式**：优化已有prompt

**输入参数**:
```typescript
{
  characterId: string;          // 角色ID
  simpleDescription?: string;    // 用户的简单中文描述
  currentPrompt?: string;        // 当前已有的prompt
  mode?: "generate" | "optimize" // 模式选择
}
```

**返回值**:
```typescript
{
  success: boolean;
  prompt?: string;  // 生成的专业英文prompt
  error?: string;
}
```

#### `generateStylePromptFromDescription(characterId, simpleDescription)`

快捷方法，用于从简单描述生成prompt。

#### `optimizeStylePrompt(characterId, currentPrompt)`

快捷方法，用于优化现有prompt。

### AI Prompt设计

#### 系统提示词要点

1. **角色定位**：专业的AI图像生成prompt专家
2. **输出要求**：
   - 必须使用英文
   - 遵循最佳实践结构（主体→场景→风格→质量）
   - 详细但不冗余
   - 使用专业术语
3. **重点关注**：可变元素（服装、配饰、妆容、姿势、表情、场景）
4. **避免重复**：不重复角色基础外貌（已在character.appearance中定义）

#### 用户提示词构建

会自动包含以下上下文：
- 角色名称
- 角色性格描述
- 角色基础外貌（固定特征）
- 用户输入的简单描述或当前prompt

### UI组件更新

**文件**: `src/components/projects/characters/character-style-info.tsx`

#### 新增状态

```typescript
const [isGenerating, setIsGenerating] = useState(false);
const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
```

#### 新增处理函数

- `handleOptimizePrompt()`: 优化现有描述
- `handleGeneratePrompt()`: 生成新描述
- `handleAcceptPrompt()`: 接受AI建议
- `handleRejectPrompt()`: 拒绝AI建议

#### UI布局

```
造型描述 [?] [✨]
┌─────────────────────────────────┐
│ EditableTextarea                │
│ (用户输入区域)                  │
└─────────────────────────────────┘

┌─────────────────────────────────┐ (AI建议卡片，条件渲染)
│ ✨ AI 建议      [✓接受] [✗拒绝] │
│ Generated prompt here...        │
└─────────────────────────────────┘
```

#### 组件Props更新

新增必需参数：
```typescript
characterId: string;  // 用于调用AI生成API
```

## 文件清单

### 新建文件
- `src/lib/actions/character/prompt-generation.ts` - AI生成逻辑

### 修改文件
- `src/lib/actions/character/index.ts` - 导出新函数
- `src/components/projects/characters/character-style-info.tsx` - UI交互
- `src/components/projects/characters/character-style-tab.tsx` - 传递characterId参数

## 使用流程

### 场景1：从零开始生成

1. 用户创建新造型，输入造型名称（如"晚礼服"）
2. 不输入或只输入简单中文描述
3. 点击Sparkles按钮
4. AI基于角色信息和造型名称生成专业英文prompt
5. 用户查看建议，点击"接受"
6. 自动保存到数据库

### 场景2：优化现有描述

1. 用户已有一些描述内容（可能是中文或不够专业的英文）
2. 点击Sparkles按钮
3. AI优化描述，转换为专业的英文prompt
4. 用户对比原文和建议，决定是否接受
5. 接受后自动保存

### 场景3：拒绝建议

1. 用户触发AI生成
2. 查看建议后发现不满意
3. 点击"拒绝"按钮
4. 建议卡片消失，原内容保持不变
5. 可以修改描述后重新生成

## 优势

### 1. 降低使用门槛
- 不需要了解Stable Diffusion prompt语法
- 不需要英文能力
- 中文简单描述即可获得专业结果

### 2. 提升内容质量
- AI生成的prompt结构专业
- 包含必要的质量标签
- 遵循最佳实践

### 3. 加速工作流
- 快速生成多个造型变体
- 一键优化现有内容
- 减少试错时间

### 4. 保持一致性
- 所有造型的prompt风格统一
- 自动考虑角色基础信息
- 避免重复描述固定特征

## 成本分析

- 每次生成约0.002-0.01美元（GPT-4 API调用）
- 相比图像生成成本（约0.3-1美元/张）非常便宜
- 可以显著提升图片生成成功率，减少重试次数

## 未来扩展

### 计划功能

- [ ] 批量生成多个造型变体
- [ ] 造型模板库（常见造型的prompt模板）
- [ ] 风格预设（写实、动漫、水彩等）
- [ ] 从参考图提取描述
- [ ] 多语言支持（其他语言描述转英文）

### 性能优化

- [ ] 添加请求缓存（相同输入返回缓存结果）
- [ ] 添加频率限制（防止滥用）
- [ ] 批量处理支持（一次生成多个）

## 测试建议

### 功能测试

1. **生成模式测试**
   - 空描述 + 造型名称 → 验证生成结果
   - 简单中文描述 → 验证转换质量
   - 只有造型名称 → 验证是否能生成

2. **优化模式测试**
   - 中文描述 → 验证转换为英文
   - 简单英文 → 验证优化效果
   - 已有专业prompt → 验证进一步优化

3. **交互测试**
   - 点击接受 → 验证自动保存
   - 点击拒绝 → 验证内容不变
   - 连续生成 → 验证状态管理

4. **错误处理**
   - 网络失败 → 验证错误提示
   - API超时 → 验证降级处理
   - 空角色信息 → 验证提示引导

### 边界测试

- 角色信息缺失（无appearance）
- 极长描述（>1000字符）
- 特殊字符处理
- 并发请求

### UI测试

- 移动端适配
- Loading状态显示
- Toast提示
- 动画效果

## 配置要求

### 环境变量

```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1 (可选)
OPENAI_MODEL=gpt-4 (可选，默认gpt-3.5-turbo)
```

### 依赖

- OpenAI SDK
- 已有的 `openai.service.ts`
- 已有的数据库schema

## 示例

### 输入

**角色信息**:
- 名称：小美
- 性格：活泼开朗的高中生
- 外貌：黑色长发，棕色眼睛，身材娇小

**用户描述**:
```
穿着校服在教室里
```

### 输出

```
A petite high school girl in a traditional Japanese school uniform, white sailor-style blouse with navy blue collar and red ribbon tie, pleated navy skirt, standing in a bright classroom, cheerful expression, natural daylight streaming through windows, anime style, cel-shaded coloring, high quality illustration, detailed, clean linework, vibrant colors
```

## 更新日志

### v1.0.0 (2024-12-08)

- ✅ 实现AI生成/优化功能
- ✅ 参考剧本优化的交互设计
- ✅ 智能模式切换（生成/优化）
- ✅ 完整的错误处理
- ✅ 接受/拒绝交互
- ✅ 自动保存集成

