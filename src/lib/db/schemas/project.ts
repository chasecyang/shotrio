import { pgTable, text, timestamp, integer, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
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
export const assetTypeEnum = pgEnum("asset_type", ["image", "video", "text", "audio"]);

// 资产来源类型枚举
export const assetSourceTypeEnum = pgEnum("asset_source_type", [
  "generated", // AI生成
  "uploaded",  // 用户上传
]);

// 任务类型
export const jobTypeEnum = pgEnum("job_type", [
  "asset_image", // 素材图片生成
  "asset_video", // 素材视频生成
  "asset_audio", // 素材音频生成
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

  // 全局画风设定 - 直接存储美术风格 prompt 文本
  // (e.g. "Cyberpunk style, 8k resolution, cinematic lighting")
  stylePrompt: text("style_prompt"),

  // @deprecated 不再使用，保留用于数据迁移安全
  styleId: text("style_id").references(() => artStyle.id, { onDelete: "set null" }),

  status: projectStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 2. 资产表 (Asset) - 统一的资产管理基表
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
  assetType: assetTypeEnum("asset_type").notNull(),

  // 资产来源类型
  sourceType: assetSourceTypeEnum("source_type").notNull(),

  // 灵活的元数据字段（JSON）
  meta: text("meta"), // JSON字符串，存储类型特定的元数据（CharacterMeta、AudioMeta等）

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

// 2.2 图片数据表 (Image Data) - 支持版本化，一个 asset 可以有多个 imageData
export const imageData = pgTable("image_data", {
  // 独立主键，支持多版本
  id: text("id").primaryKey(),

  // 外键关联到 asset（一对多）
  assetId: text("asset_id")
    .notNull()
    .references(() => asset.id, { onDelete: "cascade" }),

  // 图片数据
  imageUrl: text("image_url"),
  thumbnailUrl: text("thumbnail_url"),

  // 从 generationInfo 合并的生成信息
  prompt: text("prompt"),
  seed: integer("seed"),
  modelUsed: text("model_used"),
  generationConfig: text("generation_config"), // JSON
  sourceAssetIds: text("source_asset_ids").array(),

  // 版本控制
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2.3 视频数据表 (Video Data) - 支持版本化，一个 asset 可以有多个 videoData
export const videoData = pgTable("video_data", {
  // 独立主键，支持多版本
  id: text("id").primaryKey(),

  // 外键关联到 asset（一对多）
  assetId: text("asset_id")
    .notNull()
    .references(() => asset.id, { onDelete: "cascade" }),

  // 视频数据
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"), // 视频时长（毫秒）

  // 从 generationInfo 合并的生成信息
  prompt: text("prompt"),
  seed: integer("seed"),
  modelUsed: text("model_used"),
  generationConfig: text("generation_config"), // JSON
  sourceAssetIds: text("source_asset_ids").array(),

  // 版本控制
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2.4 文本数据表 (Text Data)
export const textData = pgTable("text_data", {
  assetId: text("asset_id")
    .primaryKey()
    .references(() => asset.id, { onDelete: "cascade" }),

  textContent: text("text_content"), // 文本内容（Markdown 格式）
});

// 2.5 音频数据表 (Audio Data)
export const audioData = pgTable("audio_data", {
  assetId: text("asset_id")
    .primaryKey()
    .references(() => asset.id, { onDelete: "cascade" }),

  audioUrl: text("audio_url"), // 音频 URL
  duration: integer("duration"), // 音频时长（毫秒）
  format: text("format"), // 格式：mp3, wav, m4a
  sampleRate: integer("sample_rate"), // 采样率 Hz
  bitrate: integer("bitrate"), // 比特率 kbps
  channels: integer("channels"), // 声道数：1(mono) / 2(stereo)

  // 生成信息（从 generationInfo 合并）
  prompt: text("prompt"),
  seed: integer("seed"),
  modelUsed: text("model_used"),
  generationConfig: text("generation_config"), // JSON
  sourceAssetIds: text("source_asset_ids").array(),

  // 波形数据（用于时间轴显示）
  waveformData: text("waveform_data"), // JSON: 波形采样点数组 number[]
});

// 2.6 资产标签表 (Asset Tag) - 多对多标签系统
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

  // 关联的资产ID（保留用于向后兼容）
  assetId: text("asset_id").references(() => asset.id, { onDelete: "cascade" }),

  // 关联的版本ID（新增，用于精确追踪哪个版本的任务）
  imageDataId: text("image_data_id").references(() => imageData.id, { onDelete: "cascade" }),
  videoDataId: text("video_data_id").references(() => videoData.id, { onDelete: "cascade" }),

  // 进度信息
  progress: integer("progress").default(0).notNull(), // 0-100
  totalSteps: integer("total_steps"), // 总步骤数
  currentStep: integer("current_step").default(0).notNull(),
  progressMessage: text("progress_message"), // 进度描述信息

  // 输入和输出数据（JSON格式）
  inputData: jsonb("input_data"), // JSONB type for better performance
  resultData: jsonb("result_data"), // JSONB type for better performance
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
  template: one(projectTemplate), // 模板信息（如果是模板项目）
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
  jobs: many(job), // 关联的任务（一个 asset 可以有多个 job，支持重试）
  // 扩展表关系 - imageData 和 videoData 改为 many 支持版本化
  imageDataList: many(imageData), // 多版本支持
  videoDataList: many(videoData), // 多版本支持
  textData: one(textData),
  audioData: one(audioData),
}));

export const imageDataRelations = relations(imageData, ({ one, many }) => ({
  asset: one(asset, {
    fields: [imageData.assetId],
    references: [asset.id],
  }),
  jobs: many(job), // 关联的生成任务
}));

export const videoDataRelations = relations(videoData, ({ one, many }) => ({
  asset: one(asset, {
    fields: [videoData.assetId],
    references: [asset.id],
  }),
  jobs: many(job), // 关联的生成任务
}));

export const textDataRelations = relations(textData, ({ one }) => ({
  asset: one(asset, {
    fields: [textData.assetId],
    references: [asset.id],
  }),
}));

export const audioDataRelations = relations(audioData, ({ one }) => ({
  asset: one(asset, {
    fields: [audioData.assetId],
    references: [asset.id],
  }),
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
  asset: one(asset, {
    fields: [job.assetId],
    references: [asset.id],
  }),
  // 版本关联（新增）
  imageData: one(imageData, {
    fields: [job.imageDataId],
    references: [imageData.id],
  }),
  videoData: one(videoData, {
    fields: [job.videoDataId],
    references: [videoData.id],
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

// 7. 时间轴表 (Timeline) - 视频剪辑时间轴
export const timeline = pgTable("timeline", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  // 基本信息
  title: text("title").notNull().default("未命名剪辑"),
  description: text("description"),
  
  // 时间轴配置
  duration: integer("duration").default(0).notNull(), // 总时长(毫秒)
  fps: integer("fps").default(30).notNull(), // 帧率
  resolution: text("resolution").default("1080x1920"), // 分辨率 (竖屏)
  
  // 预留扩展字段
  metadata: text("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 8. 时间轴片段表 (Timeline Clip) - 时间轴上的素材片段
export const timelineClip = pgTable("timeline_clip", {
  id: text("id").primaryKey(),
  timelineId: text("timeline_id")
    .notNull()
    .references(() => timeline.id, { onDelete: "cascade" }),
  assetId: text("asset_id")
    .notNull()
    .references(() => asset.id, { onDelete: "cascade" }),
  
  // 轨道和位置
  trackIndex: integer("track_index").default(0).notNull(), // 轨道索引（1期都是0，预留多轨道）
  startTime: integer("start_time").notNull(), // 在时间轴上的开始时间(ms)
  duration: integer("duration").notNull(), // 片段在时间轴上的时长(ms)
  
  // 素材裁剪
  trimStart: integer("trim_start").default(0).notNull(), // 素材入点(ms)
  trimEnd: integer("trim_end"), // 素材出点(ms), null表示到素材结尾
  
  // 排序
  order: integer("order").notNull(), // 在轨道内的排序
  
  // 预留扩展字段
  metadata: text("metadata"), // JSON: 转场效果、音量、滤镜等
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const timelineRelations = relations(timeline, ({ one, many }) => ({
  project: one(project, {
    fields: [timeline.projectId],
    references: [project.id],
  }),
  user: one(user, {
    fields: [timeline.userId],
    references: [user.id],
  }),
  clips: many(timelineClip),
}));

export const timelineClipRelations = relations(timelineClip, ({ one }) => ({
  timeline: one(timeline, {
    fields: [timelineClip.timelineId],
    references: [timeline.id],
  }),
  asset: one(asset, {
    fields: [timelineClip.assetId],
    references: [asset.id],
  }),
}));

// 9. 项目模板表 (Project Template) - 与 project 一对一关系
// 只有被标记为模板的项目才会有记录，避免 project 表字段膨胀
export const projectTemplate = pgTable("project_template", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => project.id, { onDelete: "cascade" }),

  videoUrl: text("video_url"), // 模板展示视频 URL
  thumbnail: text("thumbnail"), // 模板缩略图
  category: text("category"), // 分类：romance/suspense/comedy/action/fantasy 等
  order: integer("order").default(0).notNull(), // 排序权重（越大越靠前）

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const projectTemplateRelations = relations(projectTemplate, ({ one }) => ({
  project: one(project, {
    fields: [projectTemplate.projectId],
    references: [project.id],
  }),
}));
