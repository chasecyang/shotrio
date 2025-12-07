/**
 * 角色相关的 Prompt 构建函数
 * 用于生成角色图片的 AI prompt
 */

/**
 * 构建角色设定图 Prompt
 * 生成专业的动漫角色设定图，包含三视图、表情集、细节特写、身高比例图
 */
export function buildCharacterSheetPrompt(params: {
  characterName: string;
  baseAppearance: string;
  styleDescription: string;
}): string {
  const { characterName, baseAppearance, styleDescription } = params;

  // 使用自然语言构建专业的角色设定图描述
  const prompt = `Create a comprehensive character design reference sheet for ${characterName}. 

Character Description: ${baseAppearance}. ${styleDescription}.

The reference sheet should include:

1. Three-View Turnaround: Display the character in three distinct poses - a direct front view showing symmetrical features, a precise 90-degree side profile revealing silhouette and proportions, and a complete back view showing rear details. Each view should be clearly separated and aligned horizontally at the same scale.

2. Height Reference: Include a simple vertical height scale or ruler beside the full-body front view as a visual reference for the character's proportions.

3. Expression Sheet: Present 3 signature facial expressions that best represent this character's personality and emotional range. Each expression should show the face from the same front-facing angle for consistency, capturing the character's unique emotional characteristics.

4. Additional Details: Include close-up detail panels showing eye design variations (open, half-closed, closed) and key costume/accessory details with annotations.

Style Requirements: Clean professional character design, anime/manga art style, cel-shaded coloring with clear line art, organized layout on pure white background, high-quality illustration, consistent lighting across all views, masterpiece quality with sharp details and clean presentation.`;

  return prompt;
}
