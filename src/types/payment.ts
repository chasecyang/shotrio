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
  stripePaymentIntentId?: string | null;
  stripeSessionId?: string | null;
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

// 积分包配置常量 (1美金 = 100积分)
// name 和 description 使用翻译键，在 UI 中通过 t(`credits.packages.${type}.name`) 获取
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    type: "starter" as PackageType,
    name: "starter",
    price: 9,
    credits: 900,
    bonusPercent: 0,
    description: "starter",
  },
  {
    type: "basic" as PackageType,
    name: "basic",
    price: 30,
    credits: 3000,
    bonusPercent: 5,
    description: "basic",
  },
  {
    type: "standard" as PackageType,
    name: "standard",
    price: 60,
    credits: 6000,
    bonusPercent: 10,
    description: "standard",
    popular: true,
  },
  {
    type: "pro" as PackageType,
    name: "pro",
    price: 120,
    credits: 12000,
    bonusPercent: 15,
    description: "pro",
  },
  {
    type: "ultimate" as PackageType,
    name: "ultimate",
    price: 300,
    credits: 30000,
    bonusPercent: 20,
    description: "ultimate",
  },
];

// 积分消费配置 (1美金 = 100积分)
export const CREDIT_COSTS = {
  IMAGE_GENERATION: 6, // Nano Banana 图片生成：6积分/张 ($0.06, 成本$0.03, 利润率50%)
  VIDEO_GENERATION_PER_SECOND: 6, // Seedance 1.5 Pro 视频生成：6积分/秒 ($0.06, 成本$0.0175, 利润率70.8%)
  SOUND_EFFECT_GENERATION: 1, // ElevenLabs 音效生成：1积分/次 ($0.01, 成本$0.0012, 利润率88%)
  MUSIC_GENERATION: 10, // Suno 背景音乐生成：10积分/次 ($0.10, 成本$0.06, 利润率40%)
} as const;

