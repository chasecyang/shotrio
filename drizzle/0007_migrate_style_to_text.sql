-- Migration: 将项目美术风格从 ID 引用改为文本存储
-- 复制现有 styleId 对应的 prompt 到 stylePrompt 字段

UPDATE "project"
SET "style_prompt" = "art_style"."prompt"
FROM "art_style"
WHERE "project"."style_id" = "art_style"."id"
  AND "project"."style_id" IS NOT NULL
  AND ("project"."style_prompt" IS NULL OR "project"."style_prompt" = '');
