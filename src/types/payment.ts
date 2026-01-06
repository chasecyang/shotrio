import {
  TransactionType,
  OrderStatus,
  PackageType,
} from "@/lib/db/schemas/payment";

// Re-export types and enums from schema
export { TransactionType, OrderStatus, PackageType };

// 积分账户类型
export interface CreditAccount {
  id: string;
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

// 积分交易类型
export interface CreditTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balance: number;
  orderId?: string | null;
  description: string;
  metadata?: string | null;
  createdAt: Date;
}

// 订单类型
export interface Order {
  id: string;
  userId: string;
  packageType: PackageType;
  amount: string;
  credits: number;
  bonusCredits: number;
  isFirstPurchase: boolean;
  status: OrderStatus;
  creemPaymentId?: string | null;
  creemSessionId?: string | null;
  metadata?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
  updatedAt: Date;
}

// 兑换码类型
export interface RedeemCode {
  id: string;
  code: string;
  credits: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: Date | null;
  createdBy: string;
  isActive: boolean;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 兑换记录类型
export interface RedeemRecord {
  id: string;
  userId: string;
  codeId: string;
  credits: number;
  redeemedAt: Date;
}

// 积分包配置
export interface CreditPackage {
  type: PackageType;
  name: string;
  price: number; // 美元
  credits: number;
  bonusPercent: number; // 赠送百分比（每次购买都享受）
  description: string;
  popular?: boolean;
}

// 积分包配置常量 (1美金 = 10积分)
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    type: "starter" as PackageType,
    name: "体验包",
    price: 9,
    credits: 900,
    bonusPercent: 0,
    description: "适合初次体验",
  },
  {
    type: "basic" as PackageType,
    name: "基础包",
    price: 30,
    credits: 3000,
    bonusPercent: 5,
    description: "适合轻度使用，赠送5%积分",
  },
  {
    type: "standard" as PackageType,
    name: "标准包",
    price: 60,
    credits: 6000,
    bonusPercent: 10,
    description: "适合日常创作，赠送10%积分",
    popular: true,
  },
  {
    type: "pro" as PackageType,
    name: "专业包",
    price: 120,
    credits: 12000,
    bonusPercent: 15,
    description: "适合专业创作者，超值赠送15%积分",
  },
  {
    type: "ultimate" as PackageType,
    name: "旗舰包",
    price: 300,
    credits: 30000,
    bonusPercent: 20,
    description: "适合团队和重度使用，超级赠送20%积分",
  },
];

// 积分消费配置 (1美金 = 10积分)
export const CREDIT_COSTS = {
  IMAGE_GENERATION: 6, // Nano Banana 图片生成：6积分/张 ($0.06, 成本$0.03, 利润率50%)
  VIDEO_GENERATION_PER_SECOND: 6, // Veo 3.1 视频生成：6积分/秒 ($0.06, 成本$0.0125, 利润率79%)
} as const;

