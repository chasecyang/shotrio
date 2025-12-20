import { getChatCompletion } from "./openai.service";
import { randomUUID } from "crypto";
import type { ScriptElementExtractionResult } from "@/types/job";

/**
 * 从剧本中提取元素（角色、场景、道具、服装、特效）
 * @param scriptContent 剧本内容
 * @returns 提取结果
 */
export async function extractElementsFromScript(
  scriptContent: string
): Promise<ScriptElementExtractionResult> {
  try {
    const systemPrompt = `你是一位专业的影视制作助理，擅长从剧本中提取关键元素以供视觉制作使用。

# 任务
分析剧本并提取以下5类元素：
1. **角色 (character)** - 剧中人物
2. **场景 (scene)** - 拍摄地点/环境
3. **道具 (prop)** - 重要物品/工具
4. **服装 (costume)** - 角色的特色服饰
5. **特效 (effect)** - 需要特殊视觉效果的元素

# 提取要求

## 角色 (character)
- 提取所有出场的主要和次要角色
- name: 角色姓名（如剧本中所示）
- description: 简短的角色定位（3-15字），如"男主角"、"咖啡店老板"
- appearance: 详细外貌特征（年龄、性别、体型、发型、五官特点等）
- prompt: 高质量的英文AI绘图提示词，包含详细的外貌、服装、姿态、风格
- tags: 标签数组，第一个必须是"角色"，其他如"男性"、"中年"、"主角"等
- context: 出场场景或角色关系

## 场景 (scene)
- 提取剧本中的所有重要场景/地点
- name: 场景名称（简洁，如"咖啡厅"、"城市街道"）
- description: 场景的特征和氛围（10-30字）
- prompt: 英文AI绘图提示词，描述场景的视觉效果、光线、氛围
- tags: 第一个必须是"场景"，其他如"室内"、"现代"、"夜晚"等
- context: 场景在剧情中的用途或重要性

## 道具 (prop)
- 提取剧情中重要的物品（推动情节或有象征意义）
- name: 道具名称
- description: 道具的外观和作用
- prompt: 英文AI绘图提示词
- tags: 第一个必须是"道具"，其他描述特征
- context: 如何在剧中使用

## 服装 (costume)
- 提取角色的特色服装（非日常装）
- name: 服装名称，格式"角色名-服装类型"（如"张三-西装"）
- description: 服装的款式、颜色、材质
- prompt: 英文AI绘图提示词
- tags: 第一个必须是"服装"，其他如"正装"、"黑色"等
- context: 哪个角色在什么场景穿着

## 特效 (effect)
- 提取需要特殊视觉效果的元素
- name: 特效名称（如"魔法光球"、"爆炸效果"）
- description: 特效的视觉表现
- prompt: 英文AI绘图提示词
- tags: 第一个必须是"特效"，其他如"光效"、"粒子"等
- context: 出现的场景和时机

# 提取原则
1. **去重**: 相同的元素只保留一个，合并描述
2. **重要性**: 优先提取对剧情和视觉呈现重要的元素
3. **完整性**: 每个元素的prompt必须是完整的、可独立使用的AI绘图提示词
4. **英文质量**: prompt必须是高质量的英文，包含风格、细节、画质描述
5. **数量控制**: 
   - 角色: 5-15个
   - 场景: 3-10个
   - 道具: 0-8个（可选）
   - 服装: 0-5个（可选）
   - 特效: 0-5个（可选）

# 输出格式
必须返回有效的JSON，格式如下：

{
  "elements": [
    {
      "id": "uuid-string",
      "type": "character",
      "name": "李明",
      "description": "男主角，律师",
      "appearance": "35岁左右，中国男性，身高180cm，偏瘦体型，短黑发，方框眼镜，气质沉稳，眼神锐利",
      "prompt": "Chinese male lawyer Li Ming, 35 years old, 180cm tall, slim build, short black hair, square glasses, sharp gaze, wearing dark blue business suit, confident posture, professional appearance, cinematic lighting, high quality, detailed, 8k",
      "tags": ["角色", "男性", "中年", "主角", "律师"],
      "context": "主角，贯穿全剧"
    },
    {
      "id": "uuid-string",
      "type": "scene",
      "name": "现代律师事务所",
      "description": "宽敞明亮的现代办公空间，落地窗，城市景观",
      "prompt": "Modern law office interior, spacious and bright, floor-to-ceiling windows with city skyline view, contemporary furniture, glass partitions, professional atmosphere, natural lighting, clean and sophisticated, architectural photography style, high quality, 8k",
      "tags": ["场景", "室内", "现代", "办公"],
      "context": "主要场景，多场戏发生地"
    },
    {
      "id": "uuid-string",
      "type": "prop",
      "name": "重要文件夹",
      "description": "厚重的牛皮纸文件夹，边角磨损，装满法律文件",
      "prompt": "Thick brown leather folder, worn edges, filled with legal documents, papers visible, professional appearance, close-up photography, detailed texture, dramatic lighting, high quality",
      "tags": ["道具", "文件", "重要物品"],
      "context": "关键证据，推动剧情"
    }
  ]
}

# 注意事项
- 确保JSON格式正确，可以被解析
- 每个元素的id必须是唯一的UUID格式字符串
- type必须是: "character" | "scene" | "prop" | "costume" | "effect"
- tags数组的第一个元素必须是类型标签（角色/场景/道具/服装/特效）
- prompt必须是高质量的英文描述
- 不要返回任何JSON之外的文字`;

    const userPrompt = `请分析以下剧本并提取元素：

【剧本内容】
${scriptContent}

请严格按照JSON格式返回提取结果。`;

    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 4000,
        jsonMode: true,
      }
    );

    // 解析JSON响应
    const trimmedResponse = response.trim();
    const parsed = JSON.parse(trimmedResponse) as {
      elements: Array<{
        id?: string;
        type: "character" | "scene" | "prop" | "costume" | "effect";
        name: string;
        description: string;
        prompt: string;
        tags: string[];
        appearance?: string;
        context?: string;
      }>;
    };

    // 确保每个元素都有ID
    const elements = parsed.elements.map((el) => ({
      ...el,
      id: el.id || randomUUID(),
    }));

    // 统计各类型数量
    const characterCount = elements.filter((el) => el.type === "character").length;
    const sceneCount = elements.filter((el) => el.type === "scene").length;
    const propCount = elements.filter((el) => el.type === "prop").length;
    const costumeCount = elements.filter((el) => el.type === "costume").length;
    const effectCount = elements.filter((el) => el.type === "effect").length;

    return {
      elements,
      characterCount,
      sceneCount,
      propCount,
      costumeCount,
      effectCount,
    };
  } catch (error) {
    console.error("AI提取剧本元素失败:", error);
    throw new Error(
      `提取失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}

