# Prompt 组装逻辑完整说明

## 概述

本文档详细说明了系统中所有图片生成（角色、场景、分镜）的Prompt组装逻辑，包括各个组件的职责、数据流向和最终组装规则。

---

## 一、角色造型图生成

### 1.1 数据流向

```
角色基础信息 (character.appearance)
    ↓
造型描述 (characterImage.imagePrompt) - 自动生成或手动输入
    ↓
角色设定图Prompt构建 (buildCharacterSheetPrompt)
    ↓
应用项目画风
    ↓
最终Prompt → AI生成
```

### 1.2 Prompt组装详细步骤

#### 步骤1: 准备角色信息
**文件**: `src/lib/workers/processors/character-image-generation.ts:131-139`

```typescript
const baseAppearance = character.appearance || "";
const stylePrompt = finalImagePrompt; // 造型描述（自动生成或原有）

const fullPrompt = buildCharacterSheetPrompt({
  characterName: character.name,
  baseAppearance: baseAppearance,
  styleDescription: stylePrompt,
});
```

**说明**:
- `character.appearance`: 角色的基础外貌描述（如"20岁女性，长发，优雅"）
- `stylePrompt`: 该造型的具体描述（如"职业装、严肃表情、商务风格"）
- 两者结合形成完整的角色描述

#### 步骤2: 构建角色设定图Prompt
**文件**: `src/lib/prompts/character.ts:10-35`

```typescript
export function buildCharacterSheetPrompt(params: {
  characterName: string;
  baseAppearance: string;
  styleDescription: string;
}): string {
  const prompt = `Create a comprehensive character design reference sheet for ${characterName}. 

Character Description: ${baseAppearance}. ${styleDescription}.

The reference sheet should include:
1. Three-View Turnaround: 正面、侧面、背面三视图
2. Height Reference: 身高比例图
3. Expression Sheet: 3个标志性表情
4. Additional Details: 眼部细节、服饰细节

Style Requirements: Clean professional character design, anime/manga art style, 
cel-shaded coloring with clear line art, organized layout on pure white background, 
high-quality illustration, consistent lighting across all views, masterpiece quality.`;
  
  return prompt;
}
```

**Prompt结构**:
```
角色设定图框架说明
  → 角色描述 (baseAppearance + styleDescription)
  → 包含内容要求 (三视图、表情、细节等)
  → 风格要求 (动漫风格、专业布局等)
```

#### 步骤3: 应用项目画风
**文件**: `src/lib/workers/processors/character-image-generation.ts:141-149`

```typescript
// 获取项目画风
const globalStylePrompt = 
  character.project?.artStyle?.prompt ||      // 优先：美术风格表
  character.project?.stylePrompt ||           // 备选：自定义风格
  "";                                         // 默认：无

// 组装最终Prompt（画风在前）
const finalPromptWithStyle = globalStylePrompt 
  ? `${globalStylePrompt}. ${fullPrompt}` 
  : fullPrompt;
```

### 1.3 最终Prompt结构

```
[项目画风提示词]. [角色设定图Prompt]
```

**示例**:
```
Korean drama cinematography with soft romantic lighting. 
Create a comprehensive character design reference sheet for 李明. 
Character Description: 30岁男性，短发，商务精英气质. 正装、严肃表情、职业装扮.
The reference sheet should include: 1. Three-View Turnaround...
Style Requirements: Clean professional character design...
```

---

## 二、场景图生成

### 2.1 场景图的两种类型

场景图生成分为两个阶段：

1. **Master Layout（全景布局图）**: 文生图，建立空间认知
2. **Quarter View（叙事视角图）**: 图生图，从全景聚焦到表演区域

### 2.2 Master Layout（全景布局图）

#### 数据流向

```
场景描述 (scene.description)
    ↓
全景布局Prompt (buildMasterLayoutPrompt)
    ↓
保存到 sceneImage.imagePrompt
    ↓
应用项目画风
    ↓
文生图 → AI生成
```

#### Prompt组装

**步骤1: 创建场景图记录时构建Prompt**
**文件**: `src/lib/actions/scene/image.ts:66`

```typescript
const imagePrompt = buildMasterLayoutPrompt(sceneData);

await db.insert(sceneImage).values({
  id: imageId,
  sceneId,
  imageType: "master_layout",
  imagePrompt,  // 保存到数据库
  imageUrl: null,
});
```

**步骤2: Prompt构建函数**
**文件**: `src/lib/prompts/scene.ts:13-18`

```typescript
export function buildMasterLayoutPrompt(scene: Scene): string {
  const sceneDesc = scene.description || scene.name;
  
  return `Master shot, ultra wide angle. Complete spatial layout with depth layers. No people. ${sceneDesc}`;
}
```

**Prompt结构**:
```
拍摄意图 (Master shot, ultra wide angle)
  → 技术要求 (Complete spatial layout with depth layers)
  → 约束条件 (No people)
  → 场景描述 (scene.description)
```

**步骤3: Worker中应用项目画风**
**文件**: `src/lib/workers/processors/scene-image-generation.ts:89-99`

```typescript
// 从数据库读取已保存的basePrompt
const basePrompt = imageRecord.imagePrompt;

// 获取项目画风
const globalStylePrompt =
  scene.project?.artStyle?.prompt || scene.project?.stylePrompt || "";

// 组装最终Prompt（画风在前）
const fullPrompt = globalStylePrompt
  ? `${globalStylePrompt}. ${basePrompt}`
  : basePrompt;
```

**最终Prompt结构**:
```
[项目画风提示词]. [全景布局Prompt]
```

**示例**:
```
Anime style with photorealistic backgrounds and dramatic lighting. 
Master shot, ultra wide angle. Complete spatial layout with depth layers. 
No people. 现代化办公室，落地窗，玻璃门，简约装修风格。
```

### 2.3 Quarter View（叙事视角图）

#### 数据流向

```
叙事视角Prompt (buildQuarterViewPrompt)
    ↓
保存到 sceneImage.imagePrompt
    ↓
应用项目画风
    ↓
图生图 (参考: Master Layout图) → AI生成
```

#### Prompt组装

**步骤1: 创建场景图记录时构建Prompt**
**文件**: `src/lib/actions/scene/image.ts:181`

```typescript
const imagePrompt = buildQuarterViewPrompt();

await db.insert(sceneImage).values({
  id: imageId,
  sceneId,
  imageType: "quarter_view",
  imagePrompt,  // 保存到数据库
  imageUrl: null,
});
```

**步骤2: Prompt构建函数**
**文件**: `src/lib/prompts/scene.ts:31-35`

```typescript
export function buildQuarterViewPrompt(): string {
  return `Three-quarter view, 45-degree angle, medium distance. 
Zoom in to the main performance area. Show detailed props and furniture. No people.`;
}
```

**说明**:
- Quarter View是从Master Layout**转换**而来，所以不需要重复场景描述
- Prompt只描述**如何转换视角**（从全景聚焦到45度视角）
- 依赖Master Layout图片作为参考图

**步骤3: Worker中应用项目画风并使用图生图**
**文件**: `src/lib/workers/processors/scene-image-generation.ts:104-126`

```typescript
if (imageRecord.imageType === "quarter_view") {
  // 查询全景布局图
  const masterLayoutRecord = await db.query.sceneImage.findFirst({
    where: and(
      eq(sceneImage.sceneId, sceneId),
      eq(sceneImage.imageType, "master_layout")
    ),
  });

  // 使用图生图模式
  result = await editImagePro({
    prompt: fullPrompt,  // 已包含画风
    image_urls: [masterLayoutRecord.imageUrl],  // 参考全景图
    num_images: 1,
    aspect_ratio: "16:9",
    resolution: "2K",
    output_format: "png",
  });
}
```

**最终Prompt结构**:
```
[项目画风提示词]. [视角转换Prompt]
+ 参考图片: [Master Layout图]
```

**示例**:
```
Prompt: "Anime style with photorealistic backgrounds. Three-quarter view, 45-degree angle, medium distance. Zoom in to the main performance area. Show detailed props and furniture. No people."
Reference Image: [全景布局图的URL]
```

---

## 三、分镜图生成

### 3.1 数据流向

```
分镜信息 (shot表数据)
    ↓
+ 角色信息 (shotCharacters + character)
    ↓
+ 场景信息 (scene)
    ↓
构建分镜Prompt (buildShotImagePrompt)
    ↓
应用项目画风
    ↓
图生图 (参考: 场景图 + 角色图) → AI生成
```

### 3.2 Prompt组装详细步骤

#### 步骤1: 收集分镜信息
**文件**: `src/lib/workers/processors/shot-image-generation.ts:214-229`

```typescript
// 准备角色信息
const characters = shotChars.map((sc) => ({
  name: sc.character.name,
  appearance: sc.character.appearance || undefined,
  action: sc.action || undefined,
  position: sc.position || undefined,
}));

// 构建基础Prompt
const basePrompt = buildShotImagePrompt({
  shotSize: shotData.shotSize,              // 景别
  cameraMovement: shotData.cameraMovement,  // 运镜
  visualDescription: shotData.visualDescription,  // 画面描述
  sceneName: shotScene?.name,               // 场景名
  sceneDescription: shotScene?.description, // 场景描述
  characters,                               // 角色列表
});
```

#### 步骤2: 构建分镜Prompt
**文件**: `src/lib/prompts/shot.ts:43-124`

```typescript
export function buildShotImagePrompt(params: {
  shotSize: string;
  cameraMovement: string;
  visualDescription: string;
  sceneName?: string;
  sceneDescription?: string;
  characters: Array<{...}>;
}): string {
  const parts: string[] = [];

  // 1. 景别和运镜描述
  const shotSizeDesc = SHOT_SIZE_DESCRIPTIONS[shotSize] || "medium shot";
  const cameraMovementDesc = CAMERA_MOVEMENT_DESCRIPTIONS[cameraMovement] || "static camera";
  parts.push(`${shotSizeDesc}, ${cameraMovementDesc}.`);

  // 2. 角色信息（如果有）
  if (characters && characters.length > 0) {
    const characterDescs = characters.map((char) => {
      const charParts: string[] = [];
      charParts.push(char.name);
      
      if (char.position) {
        charParts.push(positionMap[char.position]);
      }
      if (char.appearance) {
        charParts.push(char.appearance);
      }
      if (char.action) {
        charParts.push(char.action);
      }
      
      return charParts.filter(Boolean).join(", ");
    });
    parts.push(characterDescs.join("; ") + ".");
  }

  // 3. 场景信息
  if (sceneName || sceneDescription) {
    const sceneInfo = sceneDescription || sceneName;
    parts.push(`Scene: ${sceneInfo}.`);
  }

  // 4. 画面描述
  if (visualDescription) {
    parts.push(visualDescription);
  }

  // 5. 通用画质要求（已优化，避免风格冲突）
  parts.push("High quality, 16:9 aspect ratio.");

  return parts.join(" ");
}
```

**Prompt结构**:
```
1. 景别 + 运镜
2. 角色描述 (名字, 位置, 外貌, 动作)
3. 场景信息
4. 画面描述 (来自AI分镜或手动输入)
5. 技术参数
```

**示例basePrompt**:
```
Medium shot, static camera. 
李明 in the center, 30岁男性商务精英气质, 站立双手握拳目光坚定; 
张雪 on the left, 25岁女性温柔气质, 坐着低头沉思. 
Scene: 现代化办公室落地窗玻璃门. 
李明站在办公室门口表情凝重背景是现代化的玻璃门. 
High quality, 16:9 aspect ratio.
```

#### 步骤3: 应用项目画风
**文件**: `src/lib/workers/processors/shot-image-generation.ts:231-239`

```typescript
// 获取项目画风
const globalStylePrompt =
  shotScene?.project?.artStyle?.prompt || 
  shotScene?.project?.stylePrompt || 
  "";

// 组装最终Prompt（画风在前）
const fullPrompt = globalStylePrompt
  ? `${globalStylePrompt}. ${basePrompt}`
  : basePrompt;
```

#### 步骤4: 准备参考图并生成
**文件**: `src/lib/workers/processors/shot-image-generation.ts:248-282`

```typescript
// 准备参考图片列表
const referenceImages: string[] = [];

// 1. 添加场景叙事视角图
if (sceneQuarterViewImage?.imageUrl) {
  referenceImages.push(sceneQuarterViewImage.imageUrl);
}

// 2. 添加角色造型图
referenceImages.push(...characterImageUrls);

// 使用图生图模式生成
if (referenceImages.length > 0) {
  result = await editImagePro({
    prompt: fullPrompt,
    image_urls: referenceImages,  // 场景图 + 角色图
    num_images: 1,
    aspect_ratio: "16:9",
    resolution: "2K",
    output_format: "png",
  });
}
```

### 3.3 最终Prompt结构

```
[项目画风提示词]. [景别+运镜] [角色描述] [场景信息] [画面描述] [技术参数]
+ 参考图片: [场景叙事视角图, 角色造型图1, 角色造型图2, ...]
```

**完整示例**:
```
Prompt: "Korean drama cinematography with soft romantic lighting. Medium shot, static camera. 李明 in the center, 30岁男性商务精英气质, 站立双手握拳目光坚定. Scene: 现代化办公室. 李明站在办公室门口表情凝重. High quality, 16:9 aspect ratio."

Reference Images: 
- [办公室场景叙事视角图]
- [李明角色造型图]
```

---

## 四、画风应用规则

### 4.1 画风来源优先级

在所有三种图片生成中，画风的获取优先级统一为：

```typescript
const globalStylePrompt = 
  project.artStyle?.prompt ||      // 1. 优先：关联的美术风格表
  project.stylePrompt ||           // 2. 备选：旧版自定义风格字段
  "";                              // 3. 默认：无风格
```

### 4.2 画风应用方式（已优化）

**统一规则**: 画风提示词放在最前面，用句号分隔

```typescript
const fullPrompt = globalStylePrompt 
  ? `${globalStylePrompt}. ${basePrompt}` 
  : basePrompt;
```

**为什么画风在前面？**
1. **权重优先**: AI处理prompt时，前面的内容权重更高
2. **风格主导**: 画风是全局指导性描述，应该首先建立风格基调
3. **避免冲淡**: 放在后面容易被具体描述冲淡效果

**优化对比**:

| 位置 | 示例 | 效果 |
|------|------|------|
| 画风在后（旧）| `Medium shot... High quality, Korean drama style.` | 画风权重低，容易被忽略 |
| 画风在前（新）| `Korean drama style. Medium shot... High quality.` | 画风权重高，主导整体风格 |

---

## 五、Prompt组装时机总结

### 5.1 角色造型图

- **构建时机**: Worker执行时（动态构建）
- **原因**: 需要调用AI自动生成造型描述
- **保存位置**: 构建完成后保存到 `characterImage.imagePrompt`

### 5.2 场景图

- **构建时机**: 创建任务时（提前构建）
- **原因**: Prompt较简单，且基于静态场景描述
- **保存位置**: 创建时保存到 `sceneImage.imagePrompt`

### 5.3 分镜图

- **构建时机**: Worker执行时（动态构建）
- **原因**: 需要关联多个数据源（角色、场景、分镜）
- **保存位置**: 不保存，每次重新生成时重新构建

---

## 六、数据库字段说明

### 6.1 画风字段

```sql
-- 美术风格表
art_style (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,  -- 画风的核心提示词
  ...
)

-- 项目表
project (
  id TEXT PRIMARY KEY,
  styleId TEXT,          -- 关联的美术风格ID
  stylePrompt TEXT,      -- 旧版自定义风格（向后兼容）
  ...
)
```

### 6.2 Prompt保存字段

```sql
-- 角色造型图
character_image (
  id TEXT PRIMARY KEY,
  imagePrompt TEXT,      -- 保存生成的造型描述
  imageUrl TEXT,
  ...
)

-- 场景视角图
scene_image (
  id TEXT PRIMARY KEY,
  imagePrompt TEXT,      -- 保存构建的场景Prompt
  imageUrl TEXT,
  ...
)

-- 分镜表
shot (
  id TEXT PRIMARY KEY,
  visualDescription TEXT,  -- 画面描述（来自AI分镜）
  imageUrl TEXT,           -- 生成的分镜图
  ...
  -- 注意：不保存完整prompt，每次重新构建
)
```

---

## 七、关键代码文件清单

### Prompt构建函数
- `src/lib/prompts/character.ts` - 角色设定图Prompt
- `src/lib/prompts/scene.ts` - 场景图Prompt
- `src/lib/prompts/shot.ts` - 分镜图Prompt

### Worker处理器
- `src/lib/workers/processors/character-image-generation.ts` - 角色图生成
- `src/lib/workers/processors/scene-image-generation.ts` - 场景图生成
- `src/lib/workers/processors/shot-image-generation.ts` - 分镜图生成

### 数据库Schema
- `src/lib/db/schemas/project.ts` - 所有表结构定义

### AI生成服务
- `src/lib/services/fal.service.ts` - 图片生成API封装

---

## 八、完整流程示例

### 示例场景：生成一个分镜图

**项目信息**:
- 画风: "韩剧风格" (Korean drama cinematography with soft romantic lighting)

**场景信息**:
- 场景: "现代办公室，落地窗，玻璃门"

**分镜信息**:
- 景别: medium_shot (中景)
- 运镜: static (固定镜头)
- 画面描述: "李明站在办公室门口，表情凝重"

**角色信息**:
- 李明: 30岁男性，短发，商务精英气质
- 动作: 站立，双手握拳，目光坚定
- 位置: 画面中央

**Prompt组装过程**:

```javascript
// 1. 构建基础分镜Prompt
const basePrompt = buildShotImagePrompt({
  shotSize: "medium_shot",
  cameraMovement: "static",
  visualDescription: "李明站在办公室门口，表情凝重",
  sceneName: "办公室",
  sceneDescription: "现代办公室，落地窗，玻璃门",
  characters: [{
    name: "李明",
    appearance: "30岁男性，短发，商务精英气质",
    action: "站立，双手握拳，目光坚定",
    position: "center"
  }]
});

// basePrompt结果:
// "Medium shot, static camera. 李明 in the center, 30岁男性短发商务精英气质, 站立双手握拳目光坚定. Scene: 现代办公室落地窗玻璃门. 李明站在办公室门口表情凝重. High quality, 16:9 aspect ratio."

// 2. 应用项目画风
const globalStylePrompt = "Korean drama cinematography with soft romantic lighting";
const fullPrompt = `${globalStylePrompt}. ${basePrompt}`;

// fullPrompt结果:
// "Korean drama cinematography with soft romantic lighting. Medium shot, static camera. 李明 in the center, 30岁男性短发商务精英气质, 站立双手握拳目光坚定. Scene: 现代办公室落地窗玻璃门. 李明站在办公室门口表情凝重. High quality, 16:9 aspect ratio."

// 3. 准备参考图
const referenceImages = [
  "https://r2.example.com/scene_office_quarter.png",  // 办公室叙事视角图
  "https://r2.example.com/character_liming.png"       // 李明角色造型图
];

// 4. 调用AI生成
await editImagePro({
  prompt: fullPrompt,
  image_urls: referenceImages,
  num_images: 1,
  aspect_ratio: "16:9",
  resolution: "2K",
  output_format: "png"
});
```

---

## 九、优化要点总结

### 已优化
✅ 画风提示词位置：从末尾移到开头
✅ 统一拼接方式：统一使用 `${globalStylePrompt}. ${basePrompt}`
✅ 简化通用描述：移除"Cinematic lighting"等可能冲突的描述

### 优化效果
✨ 画风权重提升，风格更明显
✨ 不同画风的差异更大
✨ 风格一致性更好

### 建议
💡 用户在项目设置中选择合适的画风
💡 生成图片前先测试画风效果
💡 根据题材选择匹配的画风类型

---

## 十、常见问题

### Q1: 为什么角色造型图的Prompt这么长？
**A**: 角色设定图需要包含三视图、表情、细节等多个元素，prompt需要详细说明布局和要求，确保生成专业的参考图。

### Q2: 场景图为什么分两步生成？
**A**: 
- Master Layout: 建立完整的空间认知
- Quarter View: 从全景聚焦到表演区域，这是90%对话和动作镜头的核心视角
- 分两步可以确保空间一致性

### Q3: 分镜图为什么要依赖场景图和角色图？
**A**: 使用图生图模式（image-to-image）可以保持角色外貌和场景风格的一致性，确保整个项目视觉统一。

### Q4: 如果没有场景图或角色图怎么办？
**A**: Worker会自动检测缺失的依赖，创建对应的生成任务。等依赖任务完成后，分镜图生成会自动继续。

### Q5: 可以修改生成的Prompt吗？
**A**: 
- 场景图: imagePrompt保存在数据库，可以手动修改
- 角色造型图: imagePrompt保存在数据库，可以手动修改
- 分镜图: 每次动态构建，需要修改源数据（分镜描述、角色外貌等）

---

**文档版本**: v1.0  
**最后更新**: 2024年12月  
**维护者**: 开发团队

