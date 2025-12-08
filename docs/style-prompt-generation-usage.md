# 造型描述AI生成功能 - 使用指南

## 快速开始

### 在哪里使用？

在角色管理页面，点击任意角色卡片，进入角色详情。在各个造型标签页中，您会看到**造型描述**字段右侧有一个紫色的✨按钮。

### 使用场景

#### 场景1：创建新造型，从零生成描述

**步骤**：

1. 点击"添加造型"按钮
2. 输入造型名称，例如："晚礼服"
3. 不填写造型描述，直接点击紫色✨按钮
4. AI会基于角色信息和造型名称自动生成专业的英文prompt
5. 查看生成的建议，点击"接受"应用

**示例**：

```
输入：
- 造型名称：晚礼服
- 造型描述：(空)

点击✨后生成：
An elegant evening gown in deep burgundy color, off-shoulder design with 
delicate lace details, flowing A-line skirt reaching the floor, paired with 
diamond earrings and a pearl necklace, standing in a luxurious ballroom, 
confident and graceful expression, soft warm lighting, anime style, high 
quality illustration, detailed fabric textures, cinematic composition
```

#### 场景2：基于简单中文描述生成

**步骤**：

1. 在造型描述框中输入简单的中文描述
2. 例如："穿运动装在健身房锻炼"
3. 点击紫色✨按钮
4. AI会将中文描述转换为专业的英文prompt
5. 点击"接受"应用

**示例**：

```
输入：
穿运动装在健身房锻炼

点击✨后生成：
Athletic sportswear with black sports bra and high-waisted leggings, 
white sneakers, exercising with dumbbells at a modern gym, determined 
expression with slight sweat, bright lighting from large windows, 
energetic atmosphere, anime style, dynamic composition, high quality, 
detailed muscle definition, professional fitness photography style
```

#### 场景3：优化已有描述

**步骤**：

1. 已有一些描述内容（可能不够专业或是中英混杂）
2. 直接点击紫色✨按钮
3. AI会优化当前内容，使其更专业、更适合AI绘图
4. 对比原文和建议，决定是否接受

**示例**：

```
原始描述：
wearing a school uniform in classroom, happy

点击✨后优化为：
Traditional Japanese school uniform with white sailor-style blouse, 
navy blue collar with red ribbon tie, pleated navy skirt, white knee 
socks and brown loafers, standing in a bright classroom near the 
window, cheerful smile and sparkling eyes, natural daylight streaming 
through, blackboard and desks in background, anime style, cel-shaded 
coloring, high quality illustration, clean linework, vibrant colors
```

## 交互说明

### AI生成按钮

- **位置**：造型描述字段标签右侧
- **图标**：紫色✨ Sparkles
- **智能切换**：
  - 当描述为空时：生成新描述
  - 当描述有内容时：优化描述

### AI建议卡片

生成完成后，会在描述框下方显示紫色建议卡片：

```
┌─────────────────────────────────────┐
│ ✨ AI 建议      [✓接受]  [✗拒绝]   │
│                                     │
│ (生成的专业prompt显示在这里)        │
│                                     │
└─────────────────────────────────────┘
```

#### 操作选项

- **✓ 接受**：
  - 将AI建议替换到造型描述框
  - 自动触发保存（2秒防抖）
  - 建议卡片消失
  
- **✗ 拒绝**：
  - 关闭建议卡片
  - 原内容保持不变
  - 可以继续修改后重新生成

### 状态反馈

- **生成中**：按钮显示Loading动画，禁用点击
- **成功**：显示toast提示"AI 生成完成"或"AI 优化完成"
- **失败**：显示toast错误信息，可重试

## 技术细节

### AI理解的上下文

生成时，AI会自动考虑以下信息：

1. **角色名称**：用于生成个性化描述
2. **角色性格**：影响表情、姿态描述
3. **基础外貌**：固定特征（发色、瞳色等）不会重复
4. **用户输入**：造型名称或简单描述

### 生成的Prompt结构

AI按照专业标准生成，包含：

1. **主体描述**：服装、配饰、姿势、表情
2. **场景氛围**：环境、光照、氛围
3. **艺术风格**：如anime style, cel-shaded等
4. **质量标签**：high quality, detailed, masterpiece等

### 避免的重复

AI不会重复角色的固定特征，因为这些已在"基础外貌"中定义，会在图片生成时自动合并。

## 最佳实践

### ✅ 推荐做法

1. **简洁输入**
   - 用简单中文描述关键信息即可
   - 例如："校服装，教室里，微笑"
   
2. **迭代优化**
   - 如果首次生成不满意，可以拒绝
   - 修改描述后重新生成
   - 多次尝试找到最佳效果

3. **保持一致**
   - 同一角色的多个造型使用AI生成
   - 确保风格和质量标签一致

4. **结合编辑**
   - 接受AI建议后，可以手动微调
   - 添加特定细节或调整措辞

### ❌ 避免

1. **过于复杂的输入**
   - 不需要写很长的详细描述
   - AI会自动补充专业细节

2. **英文输入（除非已经很专业）**
   - 中文更容易表达
   - AI会转换为标准英文

3. **重复基础特征**
   - 不要再描述发色、瞳色等
   - 这些已在角色基础信息中

## 常见问题

### Q: 生成的描述可以修改吗？

A: 可以！接受AI建议后，描述会填入编辑框，您可以继续手动修改。修改会自动保存（2秒防抖）。

### Q: 如果生成的结果不满意怎么办？

A: 
1. 点击"拒绝"关闭建议
2. 修改您的输入描述
3. 重新点击✨生成
4. 可以多次尝试直到满意

### Q: 生成需要多长时间？

A: 通常3-8秒，取决于网络和API响应速度。期间按钮会显示Loading动画。

### Q: 生成失败了怎么办？

A: 
1. 检查网络连接
2. 确保OpenAI API配置正确
3. 查看错误提示，按提示操作
4. 可以重试

### Q: 会产生额外费用吗？

A: 每次生成会调用OpenAI API，产生约0.002-0.01美元的费用。相比图像生成成本（0.3-1美元/张）很便宜，且能显著提升图片质量。

### Q: 可以批量生成多个造型吗？

A: 当前版本需要逐个生成。批量功能已在规划中。

### Q: 生成的prompt支持哪些AI绘图工具？

A: 生成的prompt遵循通用最佳实践，适用于：
- Stable Diffusion
- FLUX
- Midjourney
- DALL-E
- 以及其他主流AI绘图工具

## 高级技巧

### 技巧1：组合关键词

输入多个关键词让AI组合：
```
输入：战斗姿态 + 受伤 + 夜晚
生成：包含战斗动作、伤痕、夜间场景的完整prompt
```

### 技巧2：指定风格

在描述中提及想要的风格：
```
输入：写实风格，摄影级别
生成：会包含photorealistic, professional photography等标签
```

### 技巧3：迭代细化

第一次生成后，接受建议，然后手动微调，再次点击✨优化：
```
第1次：基础生成
手动添加：specific details
第2次：优化整合
```

### 技巧4：参考场景

描述具体场景帮助AI理解氛围：
```
输入：在雨中奔跑
生成：会包含雨水、湿润、动态感等细节
```

## 反馈与建议

如果您在使用过程中遇到问题或有改进建议，欢迎反馈！

常见反馈方式：
- 提交Issue
- 联系开发团队
- 在社区讨论

---

**享受AI辅助创作，让角色设计更高效！** ✨

