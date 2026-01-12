#!/usr/bin/env bash
#
# Auto Todo Executor (Shell 版本)
#
# 使用方式:
#   ./scripts/auto-todo.sh              # 执行所有 Auto Tasks
#   ./scripts/auto-todo.sh --dry-run    # 预览要执行的任务
#   ./scripts/auto-todo.sh --limit 1    # 只执行 1 个任务
#

set -e

TODO_FILE="docs/todo.md"
REPORT_DIR="docs/reports"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 参数解析
DRY_RUN=false
LIMIT=999

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

echo -e "${BLUE}🤖 Auto Todo Executor${NC}"
echo ""

# 检查 todo 文件是否存在
if [[ ! -f "$TODO_FILE" ]]; then
  echo -e "${RED}错误: $TODO_FILE 不存在${NC}"
  exit 1
fi

# 解析 Auto Tasks 部分的待办事项
# 找到 [auto] 或 "Auto Tasks" section，然后提取未完成的 todo
parse_todos() {
  local in_auto_section=false
  local todos=()
  local line_num=0
  local todo_id=0

  while IFS= read -r line; do
    ((line_num++))

    # 检测 section
    if [[ "$line" =~ ^##\  ]]; then
      if [[ "$line" =~ \[auto\] ]] || [[ "$line" =~ "Auto Tasks" ]]; then
        in_auto_section=true
      else
        in_auto_section=false
      fi
      continue
    fi

    # 只处理 Auto Tasks 部分
    if [[ "$in_auto_section" == false ]]; then
      continue
    fi

    # 匹配未完成的 todo: [ ] 或 []
    if [[ "$line" =~ ^\[\ ?\](.+)$ ]]; then
      ((todo_id++))
      local desc="${BASH_REMATCH[1]}"
      desc="${desc## }"  # trim leading space
      todos+=("$todo_id|$desc")
    fi
  done < "$TODO_FILE"

  printf '%s\n' "${todos[@]}"
}

# 获取待执行的 todos (兼容 macOS)
TODOS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && TODOS+=("$line")
done < <(parse_todos)

echo -e "📋 找到 ${#TODOS[@]} 个待执行任务"
echo ""

if [[ ${#TODOS[@]} -eq 0 ]]; then
  echo -e "${GREEN}✨ 没有待执行的任务！${NC}"
  exit 0
fi

# 显示任务列表
echo "待执行任务："
for todo in "${TODOS[@]}"; do
  IFS='|' read -r id desc <<< "$todo"
  echo "  #$id $desc"
done
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo -e "${YELLOW}🔍 Dry run 模式，不实际执行${NC}"
  exit 0
fi

# 创建报告目录
mkdir -p "$REPORT_DIR"

# 执行任务
SUCCESS_COUNT=0
FAIL_COUNT=0
EXECUTED=0

for todo in "${TODOS[@]}"; do
  if [[ $EXECUTED -ge $LIMIT ]]; then
    break
  fi

  IFS='|' read -r id desc <<< "$todo"
  ((EXECUTED++))

  echo ""
  echo -e "${BLUE}============================================================${NC}"
  echo -e "${BLUE}🚀 [$EXECUTED/${#TODOS[@]}] 执行任务 #$id: $desc${NC}"
  echo -e "${BLUE}============================================================${NC}"
  echo ""

  START_TIME=$(date +%s)

  # 构建 prompt
  PROMPT="/do-todo #$id $desc"

  # 执行 claude，捕获输出
  OUTPUT=$(claude -p "$PROMPT" --max-turns 100 2>&1)
  EXIT_CODE=$?
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}✅ 任务 #$id 完成 (${DURATION}s)${NC}"
    ((SUCCESS_COUNT++))

    # 显示摘要：提取最后200字符作为摘要
    echo ""
    echo -e "${YELLOW}📋 摘要:${NC}"
    echo "$OUTPUT" | tail -c 500 | head -c 300
    echo ""
  else
    echo -e "${RED}❌ 任务 #$id 失败 (${DURATION}s)${NC}"
    ((FAIL_COUNT++))

    # 显示错误信息
    echo ""
    echo -e "${RED}错误信息:${NC}"
    echo "$OUTPUT" | tail -c 300
    echo ""
  fi
done

# 汇总
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}📊 执行汇总${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}✅ 成功: $SUCCESS_COUNT${NC}"
echo -e "${RED}❌ 失败: $FAIL_COUNT${NC}"
