"use server";

/**
 * 统一的错误处理包装器
 * 自动捕获异常并返回标准格式的响应
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorPrefix?: string
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "操作失败";
    const fullMessage = errorPrefix ? `${errorPrefix}: ${errorMessage}` : errorMessage;
    
    console.error(fullMessage, error);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 简化版错误处理，直接返回数据或抛出错误
 * 用于不需要 {success, data, error} 格式的场景
 */
export async function wrapAction<T>(
  fn: () => Promise<T>,
  errorPrefix?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "操作失败";
    const fullMessage = errorPrefix ? `${errorPrefix}: ${errorMessage}` : errorMessage;
    
    console.error(fullMessage, error);
    throw error;
  }
}

