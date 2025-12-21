# 积分付费体系实施总结

## 已完成功能

### 1. 数据库设计 ✅
创建了5个新表用于积分和支付系统：
- `credits` - 用户积分账户
- `credit_transactions` - 积分交易明细
- `orders` - 订单记录
- `redeem_codes` - 兑换码
- `redeem_records` - 兑换记录

### 2. Creem支付集成 ✅
- 安装了 `@creem_io/nextjs` SDK
- 创建了 Creem 配置文件
- 实现了支付会话创建和webhook处理

### 3. Server Actions ✅
实现了完整的后端逻辑：

**积分管理：**
- `getCreditBalance()` - 获取积分余额
- `hasEnoughCredits()` - 检查积分是否充足
- `getCreditTransactions()` - 获取交易记录
- `spendCredits()` - 消费积分
- `addCredits()` - 增加积分
- `refundCredits()` - 退款积分

**支付管理：**
- `createCheckoutSession()` - 创建支付会话
- `getUserOrders()` - 获取订单列表
- `getOrderById()` - 获取订单详情
- `handleCreemWebhook()` - 处理支付webhook

**兑换码管理：**
- `useRedeemCode()` - 使用兑换码
- `generateRedeemCode()` - 生成兑换码（管理员）
- `batchGenerateRedeemCodes()` - 批量生成（管理员）
- `getAllRedeemCodes()` - 获取兑换码列表（管理员）
- `updateRedeemCodeStatus()` - 更新兑换码状态（管理员）

### 4. 前端页面 ✅
**用户端：**
- `/credits` - 积分中心主页
- `/credits/success` - 支付成功页面
- 积分余额卡片组件
- 积分包选择卡片组件
- 交易记录列表组件
- 兑换码弹窗组件

**管理端：**
- `/admin/redeem-codes` - 兑换码管理页面
- 兑换码生成器组件
- 兑换码列表和管理功能

### 5. AI服务集成 ✅
在图片和视频生成中集成了积分扣费：
- 生成前检查并扣除积分
- 生成失败自动退款
- 记录详细的消费元数据

**消费标准（1美金 = 10积分）：**
- 图片生成：8积分/张（成本$0.039，售价$0.08，利润率51%）
- 视频生成（带音频）：20积分/秒（成本$0.14/秒，售价$0.20/秒，利润率30%）
- 视频生成（无音频）：12积分/秒（成本$0.07/秒，售价$0.12/秒，利润率71%）

### 6. 国际化 ✅
在 `messages/zh.json` 中添加了完整的中文文案，包括：
- 积分余额相关
- 积分包介绍
- 交易记录
- 订单状态
- 兑换码功能
- 管理后台文案

## 积分包定价（阶梯式赠送，1美金 = 10积分）

| 积分包 | 价格 | 基础积分 | 赠送比例 | 赠送积分 | 总积分 | 价值 |
|--------|------|---------|---------|---------|--------|------|
| 体验包 | $9 | 900 | 0% | 0 | 900 | 112张图/45秒视频 |
| 基础包 | $30 | 3000 | 5% | +150 | 3150 | 393张图/157秒视频 |
| 标准包 | $60 | 6000 | 10% | +600 | 6600 | 825张图/330秒视频 |
| 专业包 | $120 | 12000 | 15% | +1800 | 13800 | 1725张图/690秒视频 |
| 旗舰包 | $300 | 30000 | 20% | +6000 | 36000 | 4500张图/1800秒视频 |

**赠送策略**：购买越多，赠送比例越高（0% → 5% → 10% → 15% → 20%），鼓励用户购买更高价值套餐。

## 需要配置的环境变量

在 `.env` 文件中添加以下配置：

```env
# Creem Payment
CREEM_API_KEY=crm_xxx                    # Creem API密钥
CREEM_WEBHOOK_SECRET=whsec_xxx           # Webhook签名密钥
NEXT_PUBLIC_CREEM_STORE_ID=store_xxx    # 商店ID（前端使用）
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 应用URL
```

## 部署步骤

### 1. 数据库迁移
```bash
npm run db:push
```

这将创建5个新表到数据库中。

### 2. 配置Creem账户
1. 注册 [Creem](https://www.creem.io/) 账户
2. 在Creem后台创建5个积分包产品：
   - 体验包：$9
   - 基础包：$30
   - 标准包：$60
   - 专业包：$120
   - 旗舰包：$300
3. 获取API密钥和商店ID
4. 配置Webhook URL：`https://your-domain.com/api/webhooks/creem`

### 3. 测试流程
1. 访问 `/credits` 页面
2. 尝试购买积分包（使用Creem测试模式）
3. 测试兑换码功能
4. 测试图片/视频生成（会自动扣除积分）
5. 管理员访问 `/admin/redeem-codes` 测试兑换码管理

## 核心特性

### 1. 阶梯式赠送机制
- 每次购买都享受赠送积分（非首购专属）
- 根据套餐价格不同，赠送比例从 0% 到 20% 递增
- 通过差异化赠送比例引导用户购买更高价值套餐
- 渐进式视觉设计突出高价值套餐的优势

### 2. 交易原子性
- 所有积分操作使用数据库事务
- 确保数据一致性
- 失败自动回滚

### 3. 详细记录
- 每笔交易都有完整的元数据
- 记录消费项目、关联资源等
- 便于后续分析和审计

### 4. 兑换码管理
- 支持一次性/多次使用
- 设置过期时间
- 批量生成（最多1000个）
- 自动生成格式：XXXX-XXXX-XXXX

### 5. 安全防护
- Webhook签名验证
- 兑换码防刷
- 积分余额校验
- 管理员权限检查

## API端点

### 用户端点
- `GET /credits` - 积分中心页面
- `GET /credits/success` - 支付成功页面

### Webhook端点
- `POST /api/webhooks/creem` - Creem支付webhook

### 管理端点
- `GET /admin/redeem-codes` - 兑换码管理页面

## 文件结构

```
src/
├── lib/
│   ├── db/schemas/
│   │   └── payment.ts                # 支付相关表结构
│   ├── actions/
│   │   ├── credits/
│   │   │   ├── balance.ts           # 余额查询
│   │   │   ├── transactions.ts      # 交易记录
│   │   │   └── spend.ts             # 积分消费
│   │   ├── payment/
│   │   │   ├── checkout.ts          # 支付会话
│   │   │   └── webhook.ts           # Webhook处理
│   │   ├── redeem/
│   │   │   └── use-code.ts          # 使用兑换码
│   │   └── admin/
│   │       └── manage-codes.ts      # 管理兑换码
│   ├── payment/
│   │   └── creem.config.ts          # Creem配置
│   └── workers/processors/
│       ├── asset-image-generation.ts  # 图片生成（已集成积分）
│       └── video-processors.ts        # 视频生成（已集成积分）
├── components/
│   ├── credits/
│   │   ├── balance-card.tsx         # 余额卡片
│   │   ├── package-card.tsx         # 积分包卡片
│   │   ├── transaction-list.tsx     # 交易列表
│   │   └── redeem-dialog.tsx        # 兑换码弹窗
│   └── admin/
│       └── code-generator.tsx       # 兑换码生成器
├── app/
│   ├── [lang]/
│   │   ├── credits/
│   │   │   ├── page.tsx            # 积分中心
│   │   │   ├── purchase-client.tsx # 购买客户端组件
│   │   │   └── success/
│   │   │       └── page.tsx        # 支付成功页面
│   │   └── admin/
│   │       └── redeem-codes/
│   │           ├── page.tsx        # 兑换码管理
│   │           └── code-actions-client.tsx
│   └── api/
│       └── webhooks/
│           └── creem/
│               └── route.ts         # Webhook路由
└── types/
    └── payment.ts                   # 类型定义
```

## 利润率分析（基于1美金 = 10积分）

**图片生成：**
- 成本：$0.039/张
- 售价：$0.08/张（8积分 × $0.01/积分，体验包价格）
- 利润：$0.041/张
- 利润率：51%

**视频生成（带音频）：**
- 成本：$0.14/秒
- 售价：$0.20/秒（20积分 × $0.01/积分，体验包价格）
- 利润：$0.06/秒
- 利润率：30%

**视频生成（无音频）：**
- 成本：$0.07/秒
- 售价：$0.12/秒（12积分 × $0.01/积分，体验包价格）
- 利润：$0.05/秒
- 利润率：71%

## 下一步建议

1. **测试阶段**
   - 在测试环境完整测试支付流程
   - 验证webhook是否正常工作
   - 测试积分扣费和退款逻辑

2. **生产部署**
   - 配置生产环境的Creem账户
   - 设置正式的webhook URL
   - 监控支付和积分系统的运行状态

3. **监控和优化**
   - 监控积分消费情况
   - 分析用户购买行为
   - 根据实际情况调整定价策略

4. **功能扩展**
   - 添加积分赠送功能
   - 实现VIP会员制度
   - 添加积分消费统计图表

