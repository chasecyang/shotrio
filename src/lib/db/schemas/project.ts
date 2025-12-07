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
  "novel_split", // 小说拆分
  "character_extraction", // 角色提取
  "character_image_generation", // 角色造型生成
  "scene_image_generation", // 场景视角生成
  "storyboard_generation", // 剧本自动分镜
  "batch_image_generation", // 批量图像生成
  "video_generation", // 视频生成
]);

// 任务状态
export const jobStatusEnum = pgEnum("job_status", [
  "pending", // 等待处理
  "processing", // 处理中
  "completed", // 已完成
  "failed", // 失败
  "cancelled", // 已取消
]);

// --- 表定义 ---

// 1. 项目表 (Project) - 对应一个微短剧项目
export const project = pgTable("project", {
  id: text("id").primaryKey(), // 建议使用 nanoid 或 uuid
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description"), // 项目简介

  // 全局画风设定 (e.g. "Cyberpunk style, 8k resolution, cinematic lighting")
  stylePrompt: text("style_prompt"),

  status: projectStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 2. 角色表 (Character) - 关键！用于固定角色长相
export const character = pgTable("character", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  description: text("description"), // 角色小传 (性格、背景)
  appearance: text("appearance"), // 基础外貌 (Text Setting)，所有状态的公约数

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 2.1 角色形象状态表 (Character Image) - 角色的肉身/状态
export const characterImage = pgTable("character_image", {
  id: text("id").primaryKey(),
  characterId: text("character_id")
    .notNull()
    .references(() => character.id, { onDelete: "cascade" }),

  label: text("label").notNull(), // 状态名称 (e.g. "Default", "Home", "Battle")
  imagePrompt: text("image_prompt"), // 该状态特定的外貌描写
  imageUrl: text("image_url"), // 生成并选定后的图片地址
  seed: integer("seed"), // 固定 Seed
  
  isPrimary: boolean("is_primary").default(false), // 是否为主图/封面

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 2.2 场景表 (Scene) - 拍摄场景/地点
export const scene = pgTable("scene", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),

  name: text("name").notNull(), // 场景名称 (e.g. "咖啡厅", "主角的家-客厅")
  description: text("description"), // 场景描述
  location: text("location"), // 位置标注 (e.g. "内景", "exterior", "半室内")
  timeOfDay: text("time_of_day"), // 时间段 (e.g. "白天", "黄昏", "night")

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 2.3 场景视角图表 (Scene Image) - 场景的不同视角参考图
export const sceneImage = pgTable("scene_image", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scene.id, { onDelete: "cascade" }),

  label: text("label").notNull(), // 视角名称 (e.g. "全景", "正面视角", "鸟瞰图")
  imagePrompt: text("image_prompt"), // 该视角的图像生成prompt
  imageUrl: text("image_url"), // 生成并选定后的图片地址
  seed: integer("seed"), // 固定 Seed
  
  isPrimary: boolean("is_primary").default(false), // 是否为主图/封面

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 3. 剧集表 (Episode) - 每一集短剧
export const episode = pgTable("episode", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  summary: text("summary"), // 本集梗概
  hook: text("hook"), // 本集钩子/亮点
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

  // 视觉内容 (Visuals)
  visualDescription: text("visual_description"), // 中文描述 (给人类看)
  visualPrompt: text("visual_prompt"), // 英文 Prompt (给 AI 看)

  // 听觉内容 (Audio)
  dialogue: text("dialogue"), // 台词
  audioPrompt: text("audio_prompt"), // 音效/BGM 提示

  // 生成结果 (Media)
  imageUrl: text("image_url"), // 生成的分镜图
  videoUrl: text("video_url"), // 生成的视频片段
  audioUrl: text("audio_url"), // TTS 语音

  // 关联 (用于辅助生成)
  // 关联这个镜头里出现的主要角色，方便提取角色的 Prompt
  mainCharacterId: text("main_character_id").references(() => character.id),
  // 关联场景，用于提取场景的视觉风格
  sceneId: text("scene_id").references(() => scene.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 5. 任务表 (Job) - 异步任务队列
export const job = pgTable("job", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => project.id, { onDelete: "cascade" }),

  // 任务类型和状态
  type: jobTypeEnum("type").notNull(),
  status: jobStatusEnum("status").default("pending").notNull(),

  // 进度信息
  progress: integer("progress").default(0).notNull(), // 0-100
  totalSteps: integer("total_steps"), // 总步骤数
  currentStep: integer("current_step").default(0).notNull(),
  progressMessage: text("progress_message"), // 进度描述信息

  // 输入和输出数据（JSON格式）
  inputData: text("input_data"), // JSON string
  resultData: text("result_data"), // JSON string
  errorMessage: text("error_message"),

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

export const projectRelations = relations(project, ({ one, many }) => ({
  user: one(user, {
    fields: [project.userId],
    references: [user.id],
  }),
  characters: many(character),
  scenes: many(scene),
  episodes: many(episode),
  jobs: many(job),
}));

export const characterRelations = relations(character, ({ one, many }) => ({
  project: one(project, {
    fields: [character.projectId],
    references: [project.id],
  }),
  images: many(characterImage),
}));

export const characterImageRelations = relations(characterImage, ({ one }) => ({
  character: one(character, {
    fields: [characterImage.characterId],
    references: [character.id],
  }),
}));

export const sceneRelations = relations(scene, ({ one, many }) => ({
  project: one(project, {
    fields: [scene.projectId],
    references: [project.id],
  }),
  images: many(sceneImage),
}));

export const sceneImageRelations = relations(sceneImage, ({ one }) => ({
  scene: one(scene, {
    fields: [sceneImage.sceneId],
    references: [scene.id],
  }),
}));

export const episodeRelations = relations(episode, ({ one, many }) => ({
  project: one(project, {
    fields: [episode.projectId],
    references: [project.id],
  }),
  shots: many(shot),
}));

export const shotRelations = relations(shot, ({ one }) => ({
  episode: one(episode, {
    fields: [shot.episodeId],
    references: [episode.id],
  }),
  // 方便在查询 shot 时直接获取角色的外观设定
  mainCharacter: one(character, {
    fields: [shot.mainCharacterId],
    references: [character.id],
  }),
  // 关联场景，用于提取场景视觉参考
  scene: one(scene, {
    fields: [shot.sceneId],
    references: [scene.id],
  }),
}));

export const jobRelations = relations(job, ({ one }) => ({
  user: one(user, {
    fields: [job.userId],
    references: [user.id],
  }),
  project: one(project, {
    fields: [job.projectId],
    references: [project.id],
  }),
}));




