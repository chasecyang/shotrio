"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Palette, Settings } from "lucide-react";
import type { ProjectDetail } from "@/types/project";
import { useTranslations } from "next-intl";

interface StyleBadgeProps {
  project: ProjectDetail;
}

export function StyleBadge({ project }: StyleBadgeProps) {
  const router = useRouter();
  const t = useTranslations("projects.settings");
  
  // 获取风格名称
  const styleName = project.stylePrompt
    ? t("customStyleName")
    : t("noStyleSet");

  const hasStyle = !!project.stylePrompt;

  return (
    <div className="group relative inline-flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={hasStyle ? "border-primary/40" : "border-muted"}
      >
        <Palette className="w-3 h-3 mr-1" />
        {styleName}
      </Badge>
      
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={() => router.push(`/projects/${project.id}/editor?view=settings`)}
      >
        <Settings className="w-3 h-3 mr-1" />
        {t("settingsButton")}
      </Button>
    </div>
  );
}

