# 画风应用优化

## 问题描述

用户反馈：分镜图的生成没有考虑到项目的画风

## 问题分析

经过检查，代码中已经实现了画风应用功能，但存在以下问题导致画风效果不明显：

### 1. Prompt拼接方式不一致

- **场景图生成**：`${basePrompt}, ${globalStylePrompt}` （用逗号拼接）
- **分镜图生成**：`${basePrompt} ${globalStylePrompt}` （用空格拼接）
- **角色图生成**：`${fullPrompt}, ${globalStylePrompt}` （用逗号拼接）

### 2. 画风提示词位置不合理

画风提示词被放在prompt的**末尾**，在AI生成时权重较低，容易被基础描述淹没。

### 3. 通用画质描述过于具体

在 `buildShotImagePrompt` 函数中，末尾添加了：
```
"Cinematic lighting, professional color grading, high quality, 16:9 aspect ratio, detailed composition."
```

这些具体的风格描述（如"电影光影"、"专业调色"）可能与项目选择的画风冲突，导致画风被冲淡。

## 解决方案

### 1. 统一画风应用方式

将所有图片生成（角色、场景、分镜）的画风应用方式统一为：

```typescript
const fullPrompt = globalStylePrompt 
  ? `${globalStylePrompt}. ${basePrompt}` 
  : basePrompt;
```

**关键改进**：
- 将画风提示词放在**最前面**，确保AI首先理解整体风格
- 使用句号 `.` 分隔，让画风成为独立的指导性描述

### 2. 简化通用画质描述

移除具有风格倾向的描述词，只保留必要的技术参数：

**修改前**：
```
"Cinematic lighting, professional color grading, high quality, 16:9 aspect ratio, detailed composition."
```

**修改后**：
```
"High quality, 16:9 aspect ratio."
```

## 修改的文件

1. **`src/lib/workers/processors/shot-image-generation.ts`**
   - 将画风提示词放在prompt前面
   - 添加注释说明优化原因

2. **`src/lib/workers/processors/scene-image-generation.ts`**
   - 将画风提示词放在prompt前面
   - 统一拼接方式

3. **`src/lib/workers/processors/character-image-generation.ts`**
   - 将画风提示词放在prompt前面
   - 统一拼接方式

4. **`src/lib/prompts/shot.ts`**
   - 简化 `buildShotImagePrompt` 中的通用画质描述
   - 简化 `buildSimpleShotPrompt` 中的通用画质描述

## 效果预期

优化后，用户在项目设置中选择的画风（如"光影动漫"、"韩剧风格"、"吉卜力手绘"等）将会更明显地体现在生成的图片中：

- **画风主导性更强**：画风提示词位于prompt开头，AI会优先考虑整体风格
- **风格一致性更好**：移除冲突的描述词，避免风格混淆
- **用户体验提升**：选择不同画风会产生明显不同的视觉效果

## 使用建议

### 给用户的建议

1. **进入项目设置**
   - 访问项目详情页
   - 点击左侧菜单的"项目设置"

2. **选择或自定义画风**
   - **预设风格**标签页：选择系统提供的9种预设画风
   - **自定义风格**标签页：输入自己的英文风格描述

3. **保存设置**
   - 点击"保存设置"按钮
   - 画风会自动应用到后续所有的角色、场景、分镜图片生成

4. **重新生成测试**
   - 如果已有图片不满意，可以点击重新生成
   - 新生成的图片将使用更新后的画风

### 画风选择指南

系统预设的画风包括：

| 画风 | 适用场景 | 特点 |
|------|---------|------|
| 电影写实 | 现实题材、悬疑、都市 | 真实光影、电影质感 |
| 光影动漫 | 青春、爱情、校园 | 超写实背景、精美光影 |
| 韩剧风格 | 爱情、偶像剧 | 柔和光线、时尚感 |
| 3D动画 | 儿童、喜剧、合家欢 | 圆润造型、明亮色彩 |
| 吉卜力手绘 | 温馨、治愈、奇幻 | 手绘质感、温暖色调 |
| 复古动漫 | 怀旧、80年代题材 | 赛璐珞风格、胶片感 |
| 美式漫画 | 动作、超级英雄 | 粗犷线条、对比强烈 |
| 厚涂插画 | 艺术性、唯美 | 厚重笔触、油画质感 |
| 少年漫画 | 热血、战斗、运动 | 动态线条、力量感 |

## 技术细节

### Prompt优先级

优化后的prompt结构：

```
[画风提示词]. [具体内容描述] [技术参数]
```

示例：
```
Korean drama cinematography with soft romantic lighting. Medium shot, static camera. Li Ming standing at office door, determined expression. Scene: modern office. High quality, 16:9 aspect ratio.
```

### 画风来源优先级

```typescript
const globalStylePrompt = 
  project.artStyle?.prompt ||      // 1. 优先：关联的美术风格表
  project.stylePrompt ||           // 2. 备选：旧版自定义风格字段
  "";                              // 3. 默认：无风格
```

## 后续优化方向

1. **画风权重控制**
   - 考虑添加画风强度参数（如：低、中、高）
   - 使用权重语法增强画风效果

2. **画风预览**
   - 在选择画风时显示示例图片
   - 支持在线生成预览

3. **混合画风**
   - 支持同时选择多个画风
   - 自动混合不同画风的特征

4. **画风学习**
   - 允许用户上传参考图片
   - AI学习用户偏好的画风

## 相关文档

- [美术风格实现文档](./ART_STYLE_IMPLEMENTATION.md)
- [美术风格初始化](./art-style-initialization.md)
- [风格提示词生成](./style-prompt-generation.md)

