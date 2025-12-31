import { pgTable, text, timestamp, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

// --- 枚举定义 ---

// 项目状态
export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "generating",
  "completed",
  "archived",
]);

// 资产类型枚举
export const assetTypeEnum = pgEnum("asset_type", ["image", "video"]);

// 资产状态枚举（统一的状态管理）
export const assetStatusEnum = pgEnum("asset_status", [
  "pending",
  "processing", 
  "completed",
  "failed",
]);

// 任务类型
export const jobTypeEnum = pgEnum("job_type", [
  "batch_image_generation", // 批量图像生成
  "asset_image_generation", // 素材图片生成
  "video_generation", // 视频生成
  "final_video_export", // 最终成片导出
]);

// 任务状态
export const jobStatusEnum = pgEnum("job_status", [
  "pending", // 等待处理
  "processing", // 处理中
  "completed", // 已完成
  "failed", // 失败
  "cancelled", // 已取消
]);

// 对话状态
export const conversationStatusEnum = pgEnum("conversation_status", [
  "active", // 运行中（AI正在执行或等待用户输入）
  "awaiting_approval", // 等待批准（有操作需要用户确认）
  "completed", // 已完成（对话已结束）
]);

// 消息角色
export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "tool", // 用于保存 function 执行结果
]);

// --- 表定义 ---

// 0. 美术风格表 (ArtStyle) - 系统预设和用户自定义风格
export const artStyle = pgTable("art_style", {
  id: text("id").primaryKey(),
  
  // 风格基本信息
  name: text("name").notNull(), // 风格名称（中文）
  nameEn: text("name_en"), // 英文名称
  description: text("description"), // 风格描述
  prompt: text("prompt").notNull(), // AI生成用的prompt
  
  // 预览和分类
  previewImage: text("preview_image"), // 预览图URL
  tags: text("tags").array(), // 标签数组
  
  // 区分系统预设 vs 用户自定义
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  // userId为null表示系统预设风格，不为null表示用户自定义风格
  
  // 元数据
  isPublic: boolean("is_public").default(false), // 用户风格是否公开分享
  usageCount: integer("usage_count").default(0).notNull(), // 使用次数统计
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 1. 项目表 (Project) - 对应一个微短剧项目
export const project = pgTable("project", {
  id: text("id").primaryKey(), // 建议使用 nanoid 或 uuid
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description"), // 项目简介

  // 全局画风设定 (e.g. "Cyberpunk style, 8k resolution, cinematic lighting")
  // @deprecated 使用 styleId 代替
  stylePrompt: text("style_prompt"),
  
  // 新增：关联美术风格
  styleId: text("style_id").references(() => artStyle.id, { onDelete: "set null" }),

  status: projectStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 2. 资产表 (Asset) - 统一的资产管理（图片和视频）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asset: any = pgTable("asset", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // 基本信息
  name: text("name").notNull(), // 资产名称，如 "张三-正面-愤怒"
  
  // 资产类型
  assetType: assetTypeEnum("asset_type").default("image").notNull(),
  
  // 图片字段（图片类型必填）
  imageUrl: text("image_url"), // 图片URL - 改为可选
  thumbnailUrl: text("thumbnail_url"), // 缩略图URL
  
  // 视频字段（视频类型必填）
  videoUrl: text("video_url"), // 视频URL
  duration: integer("duration"), // 视频时长（毫秒）
  
  // 生成信息
  prompt: text("prompt"), // 生成用的prompt
  seed: integer("seed"), // 固定seed
  modelUsed: text("model_used"), // 使用的模型
  
  // 生成配置（主要用于视频）
  generationConfig: text("generation_config"), // JSON配置
  
  // 派生关系
  sourceAssetIds: text("source_asset_ids").array(), // 多个源素材ID（用于图生图）
  derivationType: text("derivation_type"), // 'generate' | 'img2img' | 'inpaint' | 'edit' | 'remix' | 'composite'
  
  // 灵活的元数据字段（JSON）
  meta: text("meta"), // JSON字符串，存储类型特定的元数据
  
  // 状态管理（统一）
  status: assetStatusEnum("status").default("completed").notNull(),
  errorMessage: text("error_message"),
  
  // 组织和排序
  order: integer("order"), // 用于排序
  
  // 统计信息
  usageCount: integer("usage_count").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 2.1 资产标签表 (Asset Tag) - 多对多标签系统
export const assetTag = pgTable("asset_tag", {
  id: text("id").primaryKey(),
  assetId: text("asset_id")
    .notNull()
    .references(() => asset.id, { onDelete: "cascade" }),
  
  // 标签值（扁平化结构）
  tagValue: text("tag_value").notNull(), // 标签的具体值，如"角色"、"场景"、"道具"或自定义值
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. 任务表 (Job) - 异步任务队列
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const job: any = pgTable("job", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => project.id, { onDelete: "cascade" }),

  // 任务类型和状态
  type: jobTypeEnum("type").notNull(),
  status: jobStatusEnum("status").default("pending").notNull(),

  // 任务依赖关系
  parentJobId: text("parent_job_id").references(() => job.id, { onDelete: "cascade" }),

  // 进度信息
  progress: integer("progress").default(0).notNull(), // 0-100
  totalSteps: integer("total_steps"), // 总步骤数
  currentStep: integer("current_step").default(0).notNull(),
  progressMessage: text("progress_message"), // 进度描述信息

  // 输入和输出数据（JSON格式）
  inputData: text("input_data"), // JSON string
  resultData: text("result_data"), // JSON string
  errorMessage: text("error_message"),

  // 导入状态（用于提取类任务）
  isImported: boolean("is_imported").default(false).notNull(), // 是否已导入

  // 时间戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// --- 关系定义 (Relations) ---

export const artStyleRelations = relations(artStyle, ({ one, many }) => ({
  user: one(user, {
    fields: [artStyle.userId],
    references: [user.id],
  }),
  projects: many(project),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
  user: one(user, {
    fields: [project.userId],
    references: [user.id],
  }),
  artStyle: one(artStyle, {
    fields: [project.styleId],
    references: [artStyle.id],
  }),
  assets: many(asset), // 包含图片和视频
  jobs: many(job),
  conversations: many(conversation),
}));

export const assetRelations = relations(asset, ({ one, many }) => ({
  project: one(project, {
    fields: [asset.projectId],
    references: [project.id],
  }),
  user: one(user, {
    fields: [asset.userId],
    references: [user.id],
  }),
  tags: many(assetTag),
}));

export const assetTagRelations = relations(assetTag, ({ one }) => ({
  asset: one(asset, {
    fields: [assetTag.assetId],
    references: [asset.id],
  }),
}));

export const jobRelations = relations(job, ({ one, many }) => ({
  user: one(user, {
    fields: [job.userId],
    references: [user.id],
  }),
  project: one(project, {
    fields: [job.projectId],
    references: [project.id],
  }),
  parentJob: one(job, {
    fields: [job.parentJobId],
    references: [job.id],
    relationName: "jobHierarchy",
  }),
  childJobs: many(job, {
    relationName: "jobHierarchy",
  }),
}));

// 5. 对话表 (Conversation) - AI 助手对话会话
export const conversation = pgTable("conversation", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  // 基本信息
  title: text("title").notNull(), // 对话标题（自动生成或用户设置）
  status: conversationStatusEnum("status").default("active").notNull(),
  
  // Agent 状态存储
  // 对话上下文（JSON 序列化的 AgentContext）
  context: text("context"), // 用于存储创建对话时的完整上下文信息（选中的剧集、视频等）
  
  // 时间戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(), // 最后活动时间
});

// 6. 对话消息表 (Conversation Message) - 对话中的消息
export const conversationMessage = pgTable("conversation_message", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  
  // 消息内容
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  
  // Tool 消息相关字段
  toolCallId: text("tool_call_id"), // tool 消息关联的 tool_call_id
  toolCalls: text("tool_calls"), // assistant 消息的 tool_calls (JSON)
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationRelations = relations(conversation, ({ one, many }) => ({
  project: one(project, {
    fields: [conversation.projectId],
    references: [project.id],
  }),
  user: one(user, {
    fields: [conversation.userId],
    references: [user.id],
  }),
  messages: many(conversationMessage),
}));

export const conversationMessageRelations = relations(conversationMessage, ({ one }) => ({
  conversation: one(conversation, {
    fields: [conversationMessage.conversationId],
    references: [conversation.id],
  }),
}));


