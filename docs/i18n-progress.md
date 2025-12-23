# 多语言国际化进度

## 已完成的工作

### 1. 翻译文件补充
- ✅ 添加了 `legal.privacy` 和 `legal.terms` 的完整翻译（隐私政策和用户协议）
- ✅ 添加了 `projects.settings` 的完整翻译（项目设置页面）
- ✅ 添加了 `editor.resource.episodeList` 的翻译（剧集列表组件）
- ✅ 补充了 `errors` 命名空间的常用错误消息
- ✅ 所有翻译均包含中文（zh.json）和英文（en.json）版本

### 2. 组件更新
- ✅ `src/components/projects/settings/project-settings-form.tsx` - 项目设置表单
- ✅ `src/components/projects/editor/resource-panel/episode-list.tsx` - 剧集列表
- ✅ `src/app/[lang]/privacy/page.tsx` - 隐私政策页面（已使用多语言）
- ✅ `src/app/[lang]/terms/page.tsx` - 用户协议页面（已使用多语言）
- ✅ `src/components/layout/header.tsx` - 头部导航（已使用多语言）
- ✅ `src/components/layout/footer.tsx` - 页脚（已使用多语言）

### 3. Server Actions 更新
- ✅ 创建了 `src/lib/actions/utils/i18n-server.ts` - 服务端翻译辅助函数
- ✅ 更新了 `src/lib/actions/utils/error-handler.ts` - 错误处理器使用翻译
- ✅ 更新了 `src/lib/actions/admin/manage-codes.ts` - 兑换码管理（部分）

### 4. 基础设施
- ✅ `src/i18n/routing.ts` - 路由配置（支持 en 和 zh）
- ✅ `src/i18n/request.ts` - 请求配置
- ✅ `messages/en.json` 和 `messages/zh.json` - 翻译文件

## 待完成的工作

### 1. 编辑器组件（高优先级）
需要更新以下组件中的硬编码中文 toast 消息：

- `src/components/projects/editor/preview-panel/episode-editor.tsx`
  - "生成失败" × 3
  
- `src/components/projects/layout/background-tasks.tsx`
  - "任务已取消"
  - "任务已重新提交"
  - "任务不存在"
  - "该任务暂不支持查看结果"
  - "无法解析任务数据"

- `src/components/projects/editor/agent-panel/agent-context.tsx`
  - "加载对话列表失败"
  - "加载对话失败"
  - "已删除对话"
  - "删除对话失败"

- `src/components/projects/editor/agent-panel/chat-message.tsx`
  - "操作已确认，正在执行..."
  - "确认操作失败"
  - "操作已拒绝，Agent 正在提供替代方案..."
  - "拒绝操作失败"

- `src/components/projects/editor/agent-panel/agent-panel.tsx`
  - "已停止 AI 生成"

- `src/components/projects/editor/preview-panel/asset-detail-editor.tsx`
  - "加载素材失败" × 2
  - "保存失败"
  - "素材已删除"
  - "删除失败"
  - "标签不能为空"
  - "标签已添加"
  - "添加标签失败"
  - "标签已删除"
  - "删除标签失败"

- `src/components/projects/editor/resource-panel/asset-panel.tsx`
  - "加载素材失败"

- `src/components/projects/editor/preview-panel/reference-asset-selector.tsx`
  - "加载素材失败"

- `src/components/admin/art-styles/style-table.tsx`
  - "预览图生成成功"
  - "生成失败"
  - "删除成功"
  - "删除失败"

### 2. Server Actions（中优先级）
需要更新以下文件中的硬编码中文错误消息：

- `src/lib/actions/agent/chat.ts`
  - "未登录"
  - 成功/失败消息

- `src/lib/actions/payment/checkout.ts`
  - "未登录"
  - "无效的积分包类型"
  - "订单不存在"
  - 其他错误消息

- `src/lib/actions/conversation/title-generator.ts`
  - 系统提示词（可能需要根据语言动态生成）

### 3. 其他组件和页面
- 检查所有页面和组件，确保没有遗漏的硬编码文本
- 特别注意表单验证消息、按钮文本、占位符等

### 4. 测试
- 测试语言切换功能
- 测试所有页面在中英文下的显示
- 测试错误消息的翻译
- 测试 toast 消息的翻译

## 建议的下一步

1. **批量更新编辑器组件的 toast 消息**
   - 在 `messages/zh.json` 和 `messages/en.json` 中添加所有缺失的 toast 消息键
   - 逐个更新组件，将硬编码的 toast 消息替换为 `useTranslations` 调用

2. **完成 Server Actions 的翻译**
   - 使用 `getErrorMessage` 辅助函数替换所有硬编码的错误消息
   - 考虑为不同的 action 创建专门的翻译命名空间

3. **全面测试**
   - 在中文和英文环境下测试所有功能
   - 确保所有文本都正确翻译
   - 检查翻译质量和准确性

4. **文档更新**
   - 更新开发文档，说明如何添加新的翻译
   - 创建翻译贡献指南

## 技术要点

### 客户端组件翻译
```tsx
import { useTranslations } from "next-intl";

function Component() {
  const t = useTranslations("namespace");
  return <div>{t("key")}</div>;
}
```

### 服务端组件翻译
```tsx
import { getTranslations } from "next-intl/server";

async function Component() {
  const t = await getTranslations("namespace");
  return <div>{t("key")}</div>;
}
```

### Server Actions 翻译
```ts
import { getErrorMessage } from "@/lib/actions/utils/i18n-server";

export async function myAction() {
  if (error) {
    return { success: false, error: await getErrorMessage("notLoggedIn") };
  }
}
```

## 翻译文件结构

```
messages/
├── en.json  # 英文翻译
└── zh.json  # 中文翻译
```

主要命名空间：
- `common` - 通用文本
- `nav` - 导航
- `auth` - 认证
- `projects` - 项目相关
- `editor` - 编辑器
- `credits` - 积分
- `admin` - 管理后台
- `errors` - 错误消息
- `toasts` - Toast 消息
- `legal` - 法律文档

