"use client";

import { splitMessageSegments } from "@/lib/utils/asset-reference";
import { AssetReferenceChip } from "./asset-reference-chip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MessageContentWithReferencesProps {
  content: string;
  className?: string;
}

// 共享的 ReactMarkdown 组件配置
const createMarkdownComponents = (
  paragraphRenderer: Components["p"]
): Components => ({
  p: paragraphRenderer,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ children, ...props }) => {
    const inline = !props.className?.includes('language-');
    return inline ? (
      <code className="px-1 py-0.5 rounded bg-muted text-sm font-mono">
        {children}
      </code>
    ) : (
      <code className="block p-2 rounded bg-muted text-sm font-mono overflow-x-auto">
        {children}
      </code>
    );
  },
});

export function MessageContentWithReferences({
  content,
  className,
}: MessageContentWithReferencesProps) {
  const segments = splitMessageSegments(content);

  // If no references, render as plain markdown
  if (segments.every((seg) => seg.type === "text")) {
    return (
      <div className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={createMarkdownComponents(
            ({ children }) => <p className="mb-2 last:mb-0">{children}</p>
          )}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  // Render with references as chips
  return (
    <div className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <ReactMarkdown
              key={index}
              remarkPlugins={[remarkGfm]}
              components={createMarkdownComponents(
                ({ children }) => <span className="inline">{children}</span>
              )}
            >
              {segment.content}
            </ReactMarkdown>
          );
        } else if (segment.reference) {
          return (
            <AssetReferenceChip
              key={index}
              reference={segment.reference}
              variant="compact"
            />
          );
        }
        return null;
      })}
    </div>
  );
}
