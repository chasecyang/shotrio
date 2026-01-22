"use client";

import { memo } from "react";
import { motion } from "framer-motion";
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
        <div className="inline-flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1 h-1 rounded-full bg-primary"
              animate={{
                y: [-2, -6, -2],
                opacity: [0.4, 1, 0.4],
                scale: [0.8, 1, 0.8],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});


