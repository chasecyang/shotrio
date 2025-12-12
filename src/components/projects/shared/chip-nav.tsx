import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ChipNavProps {
  children: ReactNode;
  className?: string;
}

export function ChipNav({ children, className }: ChipNavProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

interface ChipNavItemProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ChipNavItem({ 
  children, 
  active = false, 
  onClick,
  className 
}: ChipNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // 基础样式
        "inline-flex items-center gap-1.5",
        "px-2.5 py-0.5 sm:px-3 sm:py-1", // 更紧凑的上下padding
        "rounded-lg text-sm font-medium transition-all duration-200",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "whitespace-nowrap shrink-0",
        // 激活状态
        active && [
          "bg-primary text-primary-foreground font-semibold",
          "hover:bg-primary/90"
        ],
        // 未激活状态
        !active && [
          "border border-border bg-transparent text-foreground",
          "hover:bg-accent/50 hover:border-accent-foreground/20",
          "active:scale-[0.98]"
        ],
        className
      )}
    >
      {children}
    </button>
  );
}

