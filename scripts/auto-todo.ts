#!/usr/bin/env tsx
/**
 * Auto Todo Executor
 *
 * 自动串行执行 todo.md 中标记为 [auto] 的任务
 *
 * 使用方式:
 *   npm run auto-todo:dry                          # 预览要执行的任务（推荐先跑这个）
 *   npm run auto-todo                              # 执行所有 Auto Tasks
 *   npx tsx scripts/auto-todo.ts --limit 1        # 只执行 1 个任务（测试用）
 *   npx tsx scripts/auto-todo.ts --filter "header" # 过滤特定任务
 *   npx tsx scripts/auto-todo.ts --all            # 执行所有任务（包括非 auto）
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ============ 配置 ============
const TODO_FILE = path.join(process.cwd(), "docs/todo.md");
const REPORT_DIR = path.join(process.cwd(), "docs/reports");

// ============ 类型定义 ============
interface TodoItem {
  lineNumber: number;
  id: number;
  description: string;
  context?: string;
  completed: boolean;
  rawLine: string;
}

interface ExecutionResult {
  todo: TodoItem;
  success: boolean;
  output: string;
  duration: number;
}

// ============ 解析命令行参数 ============
function parseArgs(): {
  limit: number;
  dryRun: boolean;
  filter: string | null;
  all: boolean;
} {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let dryRun = false;
  let filter: string | null = null;
  let all = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--filter" && args[i + 1]) {
      filter = args[i + 1];
      i++;
    } else if (args[i] === "--all") {
      all = true;
    }
  }

  return { limit, dryRun, filter, all };
}

// ============ 解析 Todo 文件 ============
function parseTodoFile(autoOnly: boolean): TodoItem[] {
  const content = fs.readFileSync(TODO_FILE, "utf-8");
  const lines = content.split("\n");
  const todos: TodoItem[] = [];

  let todoId = 0;
  let inAutoSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测 section 标题
    if (line.startsWith("## ")) {
      inAutoSection = line.includes("[auto]") || line.includes("Auto Tasks");
      continue;
    }

    // 如果开启了 autoOnly，只解析 Auto Tasks 部分
    if (autoOnly && !inAutoSection) {
      continue;
    }

    // 匹配 []xxx 或 [x]xxx 格式（方括号内可以是空、空格或 x）
    const match = line.match(/^\[([ x]?)\](.+)$/);
    if (match) {
      todoId++;
      const completed = match[1] === "x";
      const description = match[2].trim();

      // 检查下一行是否有 context
      let context: string | undefined;
      if (lines[i + 1]?.trim().startsWith("- context:")) {
        context = lines[i + 1].trim().replace("- context:", "").trim();
      }

      todos.push({
        lineNumber: i + 1,
        id: todoId,
        description,
        context,
        completed,
        rawLine: line,
      });
    }
  }

  return todos;
}

// ============ 执行单个任务 ============
async function executeTodo(todo: TodoItem): Promise<ExecutionResult> {
  const startTime = Date.now();

  // 构建 prompt
  let prompt = `/do-todo #${todo.id} ${todo.description}`;
  if (todo.context) {
    prompt += `\n\n上下文: ${todo.context}`;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 开始执行任务 #${todo.id}: ${todo.description}`);
  console.log(`${"=".repeat(60)}\n`);

  return new Promise((resolve) => {
    const claude = spawn(
      "claude",
      [
        "-p",
        prompt,
        "--output-format",
        "text",
        "--max-turns",
        "50", // 限制最大轮次
      ],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let output = "";

    claude.stdout.on("data", (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text); // 实时输出
    });

    claude.stderr.on("data", (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    claude.on("close", (code) => {
      const duration = Date.now() - startTime;
      const success = code === 0 && output.includes("✅");

      resolve({
        todo,
        success,
        output,
        duration,
      });
    });

    claude.on("error", (err) => {
      const duration = Date.now() - startTime;
      resolve({
        todo,
        success: false,
        output: `Error spawning claude: ${err.message}`,
        duration,
      });
    });
  });
}

// ============ 保存报告 ============
function saveReport(results: ExecutionResult[]): string {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(REPORT_DIR, `auto-todo-${timestamp}.md`);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  let report = `# Auto Todo 执行报告

**执行时间**: ${new Date().toLocaleString("zh-CN")}
**成功**: ${successCount} 个
**失败**: ${failCount} 个

---

`;

  for (const result of results) {
    const status = result.success ? "✅ 成功" : "❌ 失败";
    const durationSec = (result.duration / 1000).toFixed(1);

    report += `## Task #${result.todo.id}: ${result.todo.description}

**状态**: ${status}
**耗时**: ${durationSec}s

<details>
<summary>详细输出</summary>

\`\`\`
${result.output.slice(-5000)}
\`\`\`

</details>

---

`;
  }

  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// ============ 主函数 ============
async function main() {
  console.log("🤖 Auto Todo Executor\n");

  const { limit, dryRun, filter, all } = parseArgs();

  // 解析 todo 文件（默认只解析 Auto Tasks 部分）
  const autoOnly = !all;
  const allTodos = parseTodoFile(autoOnly);

  if (autoOnly) {
    console.log("📌 只执行 [auto] 标记的任务（使用 --all 执行所有任务）\n");
  }
  let pendingTodos = allTodos.filter((t) => !t.completed);

  // 应用过滤器
  if (filter) {
    pendingTodos = pendingTodos.filter((t) =>
      t.description.toLowerCase().includes(filter.toLowerCase())
    );
  }

  // 应用限制
  pendingTodos = pendingTodos.slice(0, limit);

  console.log(`📋 找到 ${allTodos.length} 个任务，其中 ${pendingTodos.length} 个待执行\n`);

  if (pendingTodos.length === 0) {
    console.log("✨ 没有待执行的任务！");
    return;
  }

  // 显示待执行任务
  console.log("待执行任务：");
  for (const todo of pendingTodos) {
    console.log(`  #${todo.id} ${todo.description}`);
  }
  console.log();

  if (dryRun) {
    console.log("🔍 Dry run 模式，不实际执行");
    return;
  }

  // 串行执行任务
  const results: ExecutionResult[] = [];

  for (let i = 0; i < pendingTodos.length; i++) {
    const todo = pendingTodos[i];
    console.log(`\n[${i + 1}/${pendingTodos.length}] 执行任务...`);

    const result = await executeTodo(todo);
    results.push(result);

    if (result.success) {
      console.log(`\n✅ 任务 #${todo.id} 完成`);
    } else {
      console.log(`\n❌ 任务 #${todo.id} 失败`);
    }
  }

  // 保存报告
  const reportPath = saveReport(results);

  // 汇总
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 执行汇总");
  console.log(`${"=".repeat(60)}`);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`📄 报告: ${reportPath}`);
}

main().catch(console.error);
