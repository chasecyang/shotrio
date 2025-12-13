"use server";

/**
 * 安全的 JSON 解析函数
 * 处理 AI 返回的可能包含格式问题的 JSON
 */
export function safeJsonParse(response: string): any {
  try {
    // 尝试直接解析
    return JSON.parse(response);
  } catch (parseError) {
    console.error("[Worker] 初次JSON解析失败，尝试清理数据:", parseError);
    
    // 清理可能的问题：
    // 1. 移除注释（// 和 /* */）
    // 2. 移除控制字符和零宽字符
    // 3. 修复尾随逗号
    let cleanedResponse = response
      // 移除单行注释
      .replace(/\/\/.*$/gm, '')
      // 移除多行注释
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // 移除控制字符（保留换行和制表符）
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // 移除零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // 修复尾随逗号
      .replace(/,(\s*[}\]])/g, '$1')
      .trim();
    
    // 尝试提取JSON对象（如果响应包含其他文本）
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }
    
    try {
      const result = JSON.parse(cleanedResponse);
      console.log("[Worker] 清理后JSON解析成功");
      return result;
    } catch (secondError) {
      console.error("[Worker] 清理后仍然解析失败");
      console.error("[Worker] 原始响应前1000字符:", response.substring(0, 1000));
      console.error("[Worker] 清理后响应前1000字符:", cleanedResponse.substring(0, 1000));
      throw new Error(`JSON解析失败: ${secondError instanceof Error ? secondError.message : String(secondError)}`);
    }
  }
}

