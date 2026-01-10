---
allowed-tools: Bash(npm run build:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
description: 自动提交工作区修改，生成规范的 commit message (需先通过 build)
---

# Git Commit Helper

## 任务流程

1. **首先运行 `npm run build` 检查代码是否能通过构建**
   - 如果构建失败，**立即停止**，向用户展示错误信息并说明失败原因
   - 如果构建成功，继续下一步
2. 运行 `git status` 查看当前工作区状态
3. 运行 `git diff --staged` 和 `git diff` 查看所有修改内容
4. 运行 `git log --oneline -5` 查看最近的 commit 风格
5. 分析修改内容，总结主要变更点
6. 生成规范的 commit message 并执行提交

## Commit Message 规范

- **标题行**：简洁描述主要变更，不超过 50 字符
- **空行**：标题与正文之间
- **正文**：用 bullet points 列出具体修改项
- **格式**：使用 conventional commits 风格 (feat:, fix:, refactor:, docs:, chore: 等)

## 示例格式

```
feat: add user authentication flow

- Implement JWT-based authentication
- Add login and signup endpoints
- Include password hashing with bcrypt
```

```
fix: resolve memory leak in cache cleanup

- Add explicit nullification of object references
- Improve cleanup routine logic
```

## 注意事项

- 不要添加 "Generated with Claude Code" 等自动生成标识
- 不要添加 Co-Authored-By 信息
- 使用英文书写 commit message
- 如果没有已暂存的修改，先询问用户是否要暂存所有修改
