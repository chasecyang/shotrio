技术栈：nextjs + taiwindcss + typescript
drizzle + postgres

* 不暴露restful api，使用server actions。
* 大组件用server component，涉及交互的小组件用client component。
* 使用suspense和skeletion组件优化加载体验，必要的时候可以使用loading.tsx。
* 使用components/ui下面的shadcn/ui组件库。请你不要用emoji，用lucide-react，用icon。
* 每次执行完代码工作后，要看看有没有冗余代码，有的话删掉
* 编写 UI 组件时，使用 `/design` skill 来确保遵循设计系统。
* 考虑多语言和本地化，不要硬编码中文文本在代码中