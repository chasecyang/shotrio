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

// 景别 (分镜的核心参数)
export const shotSizeEnum = pgEnum("shot_size", [
  "extreme_long_shot", // 大远景
  "long_shot", // 远景
  "full_shot", // 全景
  "medium_shot", // 中景
  "close_up", // 特写
  "extreme_close_up", // 大特写
]);

// 运镜方式 (摄影机运动)
export const cameraMovementEnum = pgEnum("camera_movement", [
  "static", // 固定镜头
  "push_in", // 推镜头
  "pull_out", // 拉镜头
  "pan_left", // 左摇
  "pan_right", // 右摇
  "tilt_up", // 上摇
  "tilt_down", // 下摇
  "tracking", // 移动跟拍
  "crane_up", // 升镜头
  "crane_down", // 降镜头
  "orbit", // 环绕
  "zoom_in", // 变焦推进
  "zoom_out", // 变焦拉远
  "handheld", // 手持
]);

// 任务类型
export const jobTypeEnum = pgEnum("job_type", [
  "batch_image_generation", // 批量图像生成
  "asset_image_generation", // 素材图片生成
  "script_element_extraction", // 剧本元素提取
  "video_generation", // 视频生成
  "shot_video_generation", // 单镜视频生成
  "shot_tts_generation", // 单镜TTS生成
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
]);

// 视频生成状态
export const shotVideoStatusEnum = pgEnum("shot_video_status", [
  "pending",
  "processing",
  "completed",
  "failed",
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

// 2. 资产表 (Asset) - 统一的图片资产管理
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
  
  // 图片资源（可为空，表示素材正在生成中）
  imageUrl: text("image_url"), // 图片URL
  thumbnailUrl: text("thumbnail_url"), // 缩略图URL
  
  // 生成信息
  prompt: text("prompt"), // 生成用的prompt
  seed: integer("seed"), // 固定seed
  modelUsed: text("model_used"), // 使用的模型
  
  // 派生关系
  sourceAssetIds: text("source_asset_ids").array(), // 多个源素材ID（用于图生图）
  derivationType: text("derivation_type"), // 'generate' | 'img2img' | 'inpaint' | 'edit' | 'remix' | 'composite'
  
  // 灵活的元数据字段（JSON）
  meta: text("meta"), // JSON字符串，存储类型特定的元数据
  
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

// 3. 剧集表 (Episode) - 每一集短剧
export const episode = pgTable("episode", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  summary: text("summary"), // 本集梗概
  scriptContent: text("script_content"), // 这一集的完整对话/剧本
  order: integer("order").notNull(), // 第几集

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 4. 分镜/镜头表 (Shot) - 最核心的表
export const shot = pgTable("shot", {
  id: text("id").primaryKey(),
  episodeId: text("episode_id")
    .notNull()
    .references(() => episode.id, { onDelete: "cascade" }),

  // 排序与属性
  order: integer("order").notNull(), // 镜号 (1, 2, 3...)
  shotSize: shotSizeEnum("shot_size").notNull(), // 景别
  cameraMovement: cameraMovementEnum("camera_movement").default("static"), // 运镜方式
  duration: integer("duration").default(3000), // 预估时长 (毫秒)

  // 内容描述
  description: text("description"), // 描述 (包含画面、对话、动作等)
  visualPrompt: text("visual_prompt"), // 英文 Prompt (给 AI 看)

  // 听觉内容 (Audio)
  audioPrompt: text("audio_prompt"), // 音效/BGM 提示

  // 生成结果 (Audio)
  finalAudioUrl: text("final_audio_url"), // 混音后的完整音频

  // 当前使用的视频版本（指向 shot_video 表）
  currentVideoId: text("current_video_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 4.1 分镜关联素材表 (Shot Asset) - 分镜可关联多张图片
export const shotAsset = pgTable("shot_asset", {
  id: text("id").primaryKey(),
  shotId: text("shot_id")
    .notNull()
    .references(() => shot.id, { onDelete: "cascade" }),
  assetId: text("asset_id")
    .notNull()
    .references(() => asset.id, { onDelete: "cascade" }),
  
  // 语义化标签（用于 AI 理解和 prompt 引用）
  label: text("label").notNull(), // 如 "首帧"、"汤姆-主图"、"厨房场景"、"氛围参考"
  order: integer("order").notNull(), // 决定 prompt 中的引用顺序
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4.2 分镜视频生成记录表 (Shot Video) - 支持多版本生成
export const shotVideo = pgTable("shot_video", {
  id: text("id").primaryKey(),
  shotId: text("shot_id")
    .notNull()
    .references(() => shot.id, { onDelete: "cascade" }),
  
  // 生成配置（JSON 字符串）
  // 包含: prompt, additionalAssets, model, duration, aspectRatio 等
  generationConfig: text("generation_config").notNull(),
  
  // 生成结果
  videoUrl: text("video_url"), // 生成的视频URL
  status: shotVideoStatusEnum("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 5. 任务表 (Job) - 异步任务队列
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
  assets: many(asset),
  episodes: many(episode),
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

export const episodeRelations = relations(episode, ({ one, many }) => ({
  project: one(project, {
    fields: [episode.projectId],
    references: [project.id],
  }),
  shots: many(shot),
}));

export const shotRelations = relations(shot, ({ one, many }) => ({
  episode: one(episode, {
    fields: [shot.episodeId],
    references: [episode.id],
  }),
  // 关联的素材（多张图片）
  shotAssets: many(shotAsset),
  // 生成的视频版本
  shotVideos: many(shotVideo),
  // 当前使用的视频版本
  currentVideo: one(shotVideo, {
    fields: [shot.currentVideoId],
    references: [shotVideo.id],
  }),
}));

export const shotAssetRelations = relations(shotAsset, ({ one }) => ({
  shot: one(shot, {
    fields: [shotAsset.shotId],
    references: [shot.id],
  }),
  asset: one(asset, {
    fields: [shotAsset.assetId],
    references: [asset.id],
  }),
}));

export const shotVideoRelations = relations(shotVideo, ({ one }) => ({
  shot: one(shot, {
    fields: [shotVideo.shotId],
    references: [shot.id],
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

// 转场效果枚举
export const transitionTypeEnum = pgEnum("transition_type", [
  "none", // 无转场
  "fade", // 淡入淡出
  "dissolve", // 溶解
  "wipe_left", // 左擦除
  "wipe_right", // 右擦除
  "wipe_up", // 上擦除
  "wipe_down", // 下擦除
  "slide_left", // 左滑动
  "slide_right", // 右滑动
  "zoom_in", // 放大
  "zoom_out", // 缩小
]);

// 6. 转场效果表 (Shot Transition) - 分镜间的转场配置
export const shotTransition = pgTable("shot_transition", {
  id: text("id").primaryKey(),
  episodeId: text("episode_id")
    .notNull()
    .references(() => episode.id, { onDelete: "cascade" }),
  
  // 从哪个镜头到哪个镜头（fromShotId可为null表示片头）
  fromShotId: text("from_shot_id").references(() => shot.id, { onDelete: "cascade" }),
  toShotId: text("to_shot_id")
    .notNull()
    .references(() => shot.id, { onDelete: "cascade" }),
  
  // 转场类型和时长
  transitionType: transitionTypeEnum("transition_type").default("fade").notNull(),
  duration: integer("duration").default(500), // 转场时长（毫秒）
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const shotTransitionRelations = relations(shotTransition, ({ one }) => ({
  episode: one(episode, {
    fields: [shotTransition.episodeId],
    references: [episode.id],
  }),
  fromShot: one(shot, {
    fields: [shotTransition.fromShotId],
    references: [shot.id],
    relationName: "transitionFrom",
  }),
  toShot: one(shot, {
    fields: [shotTransition.toShotId],
    references: [shot.id],
    relationName: "transitionTo",
  }),
}));

// 7. 对话表 (Conversation) - AI 助手对话会话
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
  // 待确认操作（JSON 序列化的 PendingActionInfo）
  pendingAction: text("pending_action"), // 用于存储需要用户确认的操作
  // 对话上下文（JSON 序列化的 AgentContext）
  context: text("context"), // 用于存储创建对话时的完整上下文信息（选中的剧集、分镜等）
  
  // 时间戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(), // 最后活动时间
});

// 8. 对话消息表 (Conversation Message) - 对话中的消息
export const conversationMessage = pgTable("conversation_message", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  
  // 消息内容
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  
  // AI 迭代步骤（用于前端展示历史）
  iterations: text("iterations"), // JSON string of IterationStep[]
  
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


