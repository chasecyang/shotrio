import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BetaBadgeProps {
  className?: string;
  variant?: "default" | "subtle" | "minimal";
}

export function BetaBadge({ className, variant = "default" }: BetaBadgeProps) {
  const t = useTranslations("beta");

  const variants = {
    default: "border-primary/30 bg-primary/10 text-primary font-mono tracking-wider text-[10px] uppercase",
    subtle: "border-muted-foreground/20 bg-muted/30 text-muted-foreground font-mono tracking-wider text-[10px] uppercase",
    minimal: "border-none bg-transparent text-muted-foreground/60 font-mono tracking-wider text-[10px] uppercase"
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "px-2 py-0.5 h-5 font-semibold select-none",
        variants[variant],
        className
      )}
    >
      {t("label")}
    </Badge>
  );
}

export function BetaBadgeServer({ className, variant = "default" }: BetaBadgeProps) {
  const variants = {
    default: "border-primary/30 bg-primary/10 text-primary font-mono tracking-wider text-[10px] uppercase",
    subtle: "border-muted-foreground/20 bg-muted/30 text-muted-foreground font-mono tracking-wider text-[10px] uppercase",
    minimal: "border-none bg-transparent text-muted-foreground/60 font-mono tracking-wider text-[10px] uppercase"
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "px-2 py-0.5 h-5 font-semibold select-none",
        variants[variant],
        className
      )}
    >
      BETA
    </Badge>
  );
}

