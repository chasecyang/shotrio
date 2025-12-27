"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";

/**
 * TypingIndicator Component
 * 
 * Displays an animated indicator when AI is generating responses
 */
export const TypingIndicator = memo(function TypingIndicator() {
  const t = useTranslations('editor.agent.panel');
  
  return (
    <div className="w-full px-4 py-2">
      {/* AI Generating Animation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t('aiGenerating')}</span>
        <span className="inline-flex gap-1">
          <span className="animate-bounce [animation-delay:-0.3s]">.</span>
          <span className="animate-bounce [animation-delay:-0.15s]">.</span>
          <span className="animate-bounce">.</span>
        </span>
      </div>
    </div>
  );
});

