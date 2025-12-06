"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-neutral-900 mt-4 mb-2 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-neutral-900 mt-3 mb-2 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-neutral-900 mt-3 mb-1 first:mt-0">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold text-neutral-800 mt-2 mb-1 first:mt-0">
            {children}
          </h4>
        ),
        h5: ({ children }) => (
          <h5 className="text-sm font-medium text-neutral-800 mt-2 mb-1 first:mt-0">
            {children}
          </h5>
        ),
        h6: ({ children }) => (
          <h6 className="text-sm font-medium text-neutral-700 mt-2 mb-1 first:mt-0">
            {children}
          </h6>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-neutral-900 mb-2 last:mb-0">
            {children}
          </p>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-neutral-900">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-neutral-900">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-sm text-neutral-900 leading-relaxed">
            {children}
          </li>
        ),
        // Code blocks
        code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
          if (inline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-neutral-200 text-orange-700 font-mono text-xs"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              className={cn(
                "block px-3 py-2 rounded-lg bg-neutral-800 text-neutral-100 font-mono text-xs overflow-x-auto mb-2",
                className
              )}
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto rounded-lg">
            {children}
          </pre>
        ),
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-orange-400 pl-3 py-1 my-2 text-neutral-700 italic bg-orange-50 rounded-r">
            {children}
          </blockquote>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-500 transition-colors"
          >
            {children}
          </a>
        ),
        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="min-w-full divide-y divide-neutral-200 border border-neutral-200 rounded-lg">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-neutral-50">
            {children}
          </thead>
        ),
        tbody: ({ children }) => (
          <tbody className="bg-white divide-y divide-neutral-200">
            {children}
          </tbody>
        ),
        tr: ({ children }) => (
          <tr>{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-900">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-sm text-neutral-700">
            {children}
          </td>
        ),
        // Horizontal rule
        hr: () => (
          <hr className="my-3 border-neutral-200" />
        ),
        // Strong/Bold
        strong: ({ children }) => (
          <strong className="font-semibold text-neutral-900">
            {children}
          </strong>
        ),
        // Emphasis/Italic
        em: ({ children }) => (
          <em className="italic text-neutral-800">
            {children}
          </em>
        ),
        // Strikethrough (from GFM)
        del: ({ children }) => (
          <del className="line-through text-neutral-600">
            {children}
          </del>
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

