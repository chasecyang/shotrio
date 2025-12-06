#!/usr/bin/env node

/**
 * 生成 Worker API Token
 * 用于配置 WORKER_API_SECRET 环境变量
 */

const crypto = require('crypto');

console.log('\n=================================');
console.log('🔐 Worker API Token 生成器');
console.log('=================================\n');

const token = crypto.randomBytes(32).toString('hex');

console.log('已生成安全的 64 字符随机 Token：\n');
console.log(`\x1b[32m${token}\x1b[0m\n`);
console.log('请将此 Token 添加到 .env 文件中：\n');
console.log(`\x1b[33mWORKER_API_SECRET=${token}\x1b[0m\n`);
console.log('⚠️  重要提示：');
console.log('- 不要将此 Token 提交到版本控制系统');
console.log('- 在生产环境中使用不同的 Token');
console.log('- 定期更换 Token（建议每 3-6 个月）\n');
console.log('=================================\n');

