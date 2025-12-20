"use client";

import { memo, useState, useEffect } from "react";
import type { IterationStep } from "@/types/agent";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FunctionCallCard } from "./function-call-card";

interface IterationCardProps {
  iteration: IterationStep;
  isStreaming?: boolean;
  isLastIteration?: boolean;
}

export const IterationCard = memo(function IterationCard({
  iteration,
  isStreaming,
  isLastIteration,
}: IterationCardProps) {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  // Auto-expand thinking process for last iteration when streaming
  useEffect(() => {
    if (isLastIteration && isStreaming && iteration.thinkingProcess) {
      setIsThinkingExpanded(true);
    } else if (isLastIteration && !isStreaming) {
      // Auto-collapse when streaming completes
      setIsThinkingExpanded(false);
    }
  }, [isLastIteration, isStreaming, iteration.thinkingProcess]);

  // 如果没有 content，从 thinking 中提取摘要
  const getContentFallback = () => {
    if (iteration.content) return null;
    if (!iteration.thinkingProcess) return null;

    // 从 thinking 中提取最后一句话作为摘要（通常是行动声明）
    const lines = iteration.thinkingProcess.trim().split('\n').filter(line => line.trim());
    const lastLine = lines[lines.length - 1];
    
    // 如果最后一句提到了工具调用，生成友好的描述
    if (iteration.functionCall && lastLine) {
      // 提取关键信息
      if (lastLine.includes('调用') || lastLine.includes('使用')) {
        return lastLine.trim();
      }
      // 根据工具名称生成描述，优先使用 displayName
      return `正在执行：${iteration.functionCall.displayName || iteration.functionCall.description || iteration.functionCall.name}`;
    }

    // 否则返回最后一句
    return lastLine?.trim() || null;
  };

  const fallbackContent = getContentFallback();

  return (
    <div className="space-y-2">
      {/* Thinking process (collapsible) */}
      {iteration.thinkingProcess && (
        <Collapsible
          className="w-full"
          open={isThinkingExpanded}
          onOpenChange={setIsThinkingExpanded}
        >
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                isThinkingExpanded && "rotate-180"
              )}
            />
            <span>思考过程</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1.5 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground max-h-60 overflow-y-auto break-words">
              <p className="whitespace-pre-wrap">
                {iteration.thinkingProcess}
                {isStreaming && isLastIteration && (
                  <span className="inline-block w-1 h-3 ml-0.5 bg-current animate-pulse align-middle" />
                )}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Content - 优先显示真实的 content，否则显示从 thinking 提取的摘要 */}
      {iteration.content ? (
        <div className="text-sm break-words">
          <MarkdownRenderer content={iteration.content} className="inline" />
          {isStreaming && isLastIteration && (
            <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse align-middle" />
          )}
        </div>
      ) : fallbackContent ? (
        <div className="text-sm break-words text-muted-foreground italic">
          {fallbackContent}
          {isStreaming && isLastIteration && (
            <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse align-middle" />
          )}
        </div>
      ) : null}

      {/* Function call */}
      {iteration.functionCall && (
        <FunctionCallCard functionCall={iteration.functionCall} />
      )}
    </div>
  );
});

