"use client";

/**
 * TypingIndicator Component
 * 
 * Displays an animated "thinking..." indicator when AI is processing
 */
export function TypingIndicator() {
  return (
    <div className="w-full px-4 py-2">
      {/* Typing Animation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>正在思考</span>
        <span className="inline-flex gap-1">
          <span className="animate-bounce [animation-delay:-0.3s]">.</span>
          <span className="animate-bounce [animation-delay:-0.15s]">.</span>
          <span className="animate-bounce">.</span>
        </span>
      </div>
    </div>
  );
}

