"use server";

import { getTranslations } from "next-intl/server";

/**
 * 获取服务端翻译函数
 * 用于 Server Actions 中的错误消息翻译
 */
export async function getServerTranslations(namespace: string = "errors") {
  return await getTranslations(namespace);
}

/**
 * 常用错误消息的快捷翻译
 */
export async function getErrorMessage(key: string): Promise<string> {
  const t = await getTranslations("errors");
  return t(key as never);
}

