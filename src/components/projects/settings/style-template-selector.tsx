"use client";

import { useState } from "react";
import { ArtStyle } from "@/types/art-style";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronDown, Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { TemplateButton } from "./template-button";
import { TemplateCard } from "./template-card";

interface StyleTemplateSelectorProps {
  styles: ArtStyle[];
  currentPrompt?: string | null;
  onSelect: (prompt: string) => void;
}

export function StyleTemplateSelector({
  styles,
  currentPrompt,
  onSelect,
}: StyleTemplateSelectorProps) {
  const t = useTranslations("projects.settings");
  const [expanded, setExpanded] = useState(false);

  if (styles.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-center border-2 border-dashed rounded-lg">
        <div>
          <Palette className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t("noTemplates")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 标题和展开按钮 */}
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground">
          {t("quickTemplates")}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-8"
        >
          {expanded ? t("collapseTemplates") : t("expandTemplates")}
          <ChevronDown
            className={`ml-1 h-4 w-4 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </Button>
      </div>

      {/* 折叠状态：小卡片网格 */}
      {!expanded && (
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {styles.map((style) => (
            <TemplateButton
              key={style.id}
              style={style}
              onClick={() => onSelect(style.prompt)}
            />
          ))}
        </div>
      )}

      {/* 展开状态：完整卡片 */}
      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {styles.map((style) => (
            <TemplateCard
              key={style.id}
              style={style}
              onSelect={() => onSelect(style.prompt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
