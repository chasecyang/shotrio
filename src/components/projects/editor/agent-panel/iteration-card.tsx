"use client";

import { memo } from "react";
import type { IterationStep } from "@/types/agent";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
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
  return (
    <div className="space-y-2">
      {/* Content - AI 的回复内容 */}
      {iteration.content && (
        <div className="text-sm break-words">
          <MarkdownRenderer content={iteration.content} className="inline" />
        </div>
      )}

      {/* Function call */}
      {iteration.functionCall && (
        <FunctionCallCard functionCall={iteration.functionCall} />
      )}
    </div>
  );
});

