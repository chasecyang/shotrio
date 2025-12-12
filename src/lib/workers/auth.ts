/**
 * Worker 进程认证系统
 * 用于验证内部 Worker 进程的身份，防止未授权访问
 */

/**
 * 验证 Worker Token
 * @param token - 待验证的 token
 * @returns 是否验证通过
 */
export function verifyWorkerToken(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  const expectedToken = process.env.WORKER_API_SECRET;

  if (!expectedToken) {
    console.error("[Security] WORKER_API_SECRET 未配置，拒绝所有 Worker 请求");
    return false;
  }

  // 使用时间安全的字符串比较，防止时序攻击
  return timingSafeEqual(token, expectedToken);
}

/**
 * 获取 Worker Token
 * @returns Worker token，如果未配置则抛出错误
 */
export function getWorkerToken(): string {
  const token = process.env.WORKER_API_SECRET;

  if (!token) {
    throw new Error("WORKER_API_SECRET 未配置");
  }

  return token;
}

/**
 * 时间安全的字符串比较
 * 防止时序攻击（timing attack）
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * 生成随机 Worker Token
 * 用于初始化配置
 */
export function generateWorkerToken(): string {
  // 使用 Web Crypto API 或 Node.js crypto 模块
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Node.js 环境使用动态导入
  const crypto = eval('require("crypto")') as typeof import('crypto');
  return crypto.randomBytes(32).toString("hex"); // 64 个十六进制字符
}

