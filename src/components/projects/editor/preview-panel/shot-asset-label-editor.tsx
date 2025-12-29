"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Edit3, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESET_SHOT_ASSET_LABELS, MAX_LABEL_LENGTH } from "@/lib/constants/shot-asset-labels";

interface ShotAssetLabelEditorProps {
  currentLabel: string;
  onSave: (newLabel: string) => Promise<void>;
  presetLabels?: readonly string[];
  disabled?: boolean;
}

export function ShotAssetLabelEditor({
  currentLabel,
  onSave,
  presetLabels = PRESET_SHOT_ASSET_LABELS,
  disabled = false,
}: ShotAssetLabelEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState(currentLabel);
  const [isSaving, setIsSaving] = useState(false);

  const handlePresetSelect = async (label: string) => {
    setIsSaving(true);
    try {
      await onSave(label);
      setIsOpen(false);
    } catch (error) {
      console.error("保存标签失败:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomSave = async () => {
    const trimmedLabel = customLabel.trim();
    if (!trimmedLabel) return;
    
    if (trimmedLabel.length > MAX_LABEL_LENGTH) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedLabel);
      setIsOpen(false);
    } catch (error) {
      console.error("保存标签失败:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setCustomLabel(currentLabel);
    }
    setIsOpen(open);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-auto px-2 py-1 text-xs font-normal hover:bg-accent",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="truncate max-w-[120px]">{currentLabel}</span>
          <Edit3 className="w-3 h-3 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">编辑标签</Label>
            <p className="text-xs text-muted-foreground mt-1">
              选择预设标签或输入自定义标签
            </p>
          </div>

          {/* 预设标签快速选择 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">快速选择</Label>
            <div className="flex flex-wrap gap-2">
              {presetLabels.map((label) => (
                <Badge
                  key={label}
                  variant={currentLabel === label ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors",
                    currentLabel === label && "bg-primary text-primary-foreground",
                    isSaving && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => !isSaving && handlePresetSelect(label)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          {/* 自定义输入 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">自定义标签</Label>
            <div className="flex gap-2">
              <Input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="输入自定义标签"
                maxLength={MAX_LABEL_LENGTH}
                disabled={isSaving}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCustomSave();
                  } else if (e.key === "Escape") {
                    setIsOpen(false);
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleCustomSave}
                disabled={isSaving || !customLabel.trim() || customLabel.trim() === currentLabel}
                className="h-8 w-8 p-0"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {customLabel.length}/{MAX_LABEL_LENGTH} 字符
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

