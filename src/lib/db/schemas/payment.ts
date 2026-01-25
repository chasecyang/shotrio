import { pgTable, text, timestamp, integer, boolean, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { pgEnum } from "drizzle-orm/pg-core";
import { user } from "./auth";

// 交易类型枚举
export enum TransactionType {
  PURCHASE = "purchase",
  SPEND = "spend",
  REFUND = "refund",
  BONUS = "bonus",
  REDEEM = "redeem",
}

export const transactionTypeEnum = pgEnum("transaction_type", [
  TransactionType.PURCHASE,
  TransactionType.SPEND,
  TransactionType.REFUND,
  TransactionType.BONUS,
  TransactionType.REDEEM,
]);

// 订单状态枚举
export enum OrderStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export const orderStatusEnum = pgEnum("order_status", [
  OrderStatus.PENDING,
  OrderStatus.COMPLETED,
  OrderStatus.FAILED,
  OrderStatus.REFUNDED,
]);

// 积分包类型枚举
export enum PackageType {
  STARTER = "starter",
  BASIC = "basic",
  STANDARD = "standard",
  PRO = "pro",
  ULTIMATE = "ultimate",
}

export const packageTypeEnum = pgEnum("package_type", [
  PackageType.STARTER,
  PackageType.BASIC,
  PackageType.STANDARD,
  PackageType.PRO,
  PackageType.ULTIMATE,
]);

// 1. 积分账户表
export const credits = pgTable("credits", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  balance: integer("balance").default(0).notNull(),
  totalEarned: integer("total_earned").default(0).notNull(),
  totalSpent: integer("total_spent").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 2. 积分交易明细表
export const creditTransactions = pgTable("credit_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(), // 正数=获得，负数=消费
  balance: integer("balance").notNull(), // 交易后余额
  orderId: text("order_id"), // 关联订单ID（可选）
  description: text("description").notNull(),
  metadata: text("metadata"), // JSON元数据
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. 订单表
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  packageType: packageTypeEnum("package_type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // 支付金额（美元）
  credits: integer("credits").notNull(), // 获得积分数
  bonusCredits: integer("bonus_credits").default(0).notNull(), // 奖励积分数
  isFirstPurchase: boolean("is_first_purchase").default(false).notNull(),
  status: orderStatusEnum("status").default(OrderStatus.PENDING).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSessionId: text("stripe_session_id"),
  metadata: text("metadata"), // JSON元数据
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 4. 兑换码表
export const redeemCodes = pgTable("redeem_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  credits: integer("credits").notNull(),
  maxUses: integer("max_uses").default(1).notNull(), // 最大使用次数
  usedCount: integer("used_count").default(0).notNull(), // 已使用次数
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 5. 兑换记录表
export const redeemRecords = pgTable("redeem_records", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  codeId: text("code_id")
    .notNull()
    .references(() => redeemCodes.id, { onDelete: "cascade" }),
  credits: integer("credits").notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
});

// --- 关系定义 ---

export const creditsRelations = relations(credits, ({ one }) => ({
  user: one(user, {
    fields: [credits.userId],
    references: [user.id],
  }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(user, {
    fields: [creditTransactions.userId],
    references: [user.id],
  }),
  order: one(orders, {
    fields: [creditTransactions.orderId],
    references: [orders.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(user, {
    fields: [orders.userId],
    references: [user.id],
  }),
}));

export const redeemCodesRelations = relations(redeemCodes, ({ one, many }) => ({
  creator: one(user, {
    fields: [redeemCodes.createdBy],
    references: [user.id],
  }),
  redeemRecords: many(redeemRecords),
}));

export const redeemRecordsRelations = relations(redeemRecords, ({ one }) => ({
  user: one(user, {
    fields: [redeemRecords.userId],
    references: [user.id],
  }),
  code: one(redeemCodes, {
    fields: [redeemRecords.codeId],
    references: [redeemCodes.id],
  }),
}));

