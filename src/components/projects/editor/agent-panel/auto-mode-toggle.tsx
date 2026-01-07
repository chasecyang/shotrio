"use client";

import { useTranslations } from "next-intl";
import { useAgent } from "./agent-context";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AutoModeToggle() {
  const agent = useAgent();
  const t = useTranslations();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => agent.setAutoAccept(!agent.state.isAutoAcceptEnabled)}
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/50 transition-colors shrink-0"
        >
          <span
            className={cn(
              "w-2.5 h-2.5 rounded-full border transition-all duration-300",
              agent.state.isAutoAcceptEnabled
                ? "bg-primary border-primary auto-mode-indicator"
                : "bg-transparent border-muted-foreground/50"
            )}
          />
          <span className={cn(
            "text-xs font-medium transition-colors",
            agent.state.isAutoAcceptEnabled
              ? "text-primary"
              : "text-muted-foreground"
          )}>
            {t('editor.agent.panel.autoMode')}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{t('editor.agent.panel.autoModeDescription')}</p>
      </TooltipContent>
    </Tooltip>
  );
}
