"use client";

import { memo, useState, useRef, useEffect } from "react";
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
  const thinkingCollapsedRef = useRef<HTMLDivElement>(null);
  const thinkingExpandedRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部（显示最末尾内容）
  useEffect(() => {
    if (!isStreaming || !isLastIteration) return;
    
    const targetRef = isThinkingExpanded ? thinkingExpandedRef : thinkingCollapsedRef;
    if (targetRef.current) {
      targetRef.current.scrollTop = targetRef.current.scrollHeight;
    }
  }, [iteration.thinkingProcess, isStreaming, isLastIteration, isThinkingExpanded]);

  // 渲染思考内容（复用逻辑）
  const renderThinkingContent = () => (
    <p className="whitespace-pre-wrap">
      {iteration.thinkingProcess}
      {isStreaming && isLastIteration && (
        <span className="inline-block w-1 h-3 ml-0.5 bg-current animate-pulse align-middle" />
      )}
    </p>
  );

  return (
    <div className="space-y-2">
      {/* Thinking process - 可折叠/展开 */}
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
          
          {/* 折叠状态：显示最末尾约 2 行，可滚动 */}
          {!isThinkingExpanded && (
            <div 
              ref={thinkingCollapsedRef}
              className="mt-1.5 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground overflow-y-auto break-words"
              style={{ 
                maxHeight: '3em',
                lineHeight: '1.5em'
              }}
            >
              {renderThinkingContent()}
            </div>
          )}
          
          {/* 展开状态：显示完整内容 */}
          <CollapsibleContent>
            <div 
              ref={thinkingExpandedRef}
              className="mt-1.5 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground max-h-60 overflow-y-auto break-words"
            >
              {renderThinkingContent()}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Content - 只显示真实的 content */}
      {iteration.content && (
        <div className="text-sm break-words">
          <MarkdownRenderer content={iteration.content} className="inline" />
          {isStreaming && isLastIteration && (
            <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse align-middle" />
          )}
        </div>
      )}

      {/* Function call */}
      {iteration.functionCall && (
        <FunctionCallCard functionCall={iteration.functionCall} />
      )}
    </div>
  );
});

