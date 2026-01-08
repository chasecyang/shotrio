"use client";

import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRESET_TAGS } from "@/lib/constants/asset-tags";
import { addAssetTag, removeAssetTagsByValue } from "@/lib/actions/asset";
import { toast } from "sonner";
import { AssetTag } from "@/types/asset";

interface TagEditorProps {
  assetId: string;
  tags: AssetTag[];
  onTagsChange: (tags: AssetTag[]) => void;
  disabled?: boolean;
}

export function TagEditor({
  assetId,
  tags,
  onTagsChange,
  disabled = false,
}: TagEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [removingTag, setRemovingTag] = useState<string | null>(null);

  const existingTagValues = new Set(tags.map((t) => t.tagValue));
  const availablePresetTags = PRESET_TAGS.filter(
    (tag) => !existingTagValues.has(tag)
  );

  const handleAddTag = async (tagValue: string) => {
    const trimmedValue = tagValue.trim();
    if (!trimmedValue || existingTagValues.has(trimmedValue)) return;

    setIsAdding(true);
    try {
      const result = await addAssetTag({ assetId, tagValue: trimmedValue });
      if (result.success && result.tagId) {
        const newTag: AssetTag = {
          id: result.tagId,
          assetId,
          tagValue: trimmedValue,
          createdAt: new Date(),
        };
        onTagsChange([...tags, newTag]);
        setInputValue("");
        toast.success("标签已添加");
      } else {
        toast.error(result.error || "添加标签失败");
      }
    } catch (error) {
      console.error("添加标签失败:", error);
      toast.error("添加标签失败");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveTag = async (tagValue: string) => {
    setRemovingTag(tagValue);
    try {
      const result = await removeAssetTagsByValue(assetId, tagValue);
      if (result.success) {
        onTagsChange(tags.filter((t) => t.tagValue !== tagValue));
        toast.success("标签已删除");
      } else {
        toast.error(result.error || "删除标签失败");
      }
    } catch (error) {
      console.error("删除标签失败:", error);
      toast.error("删除标签失败");
    } finally {
      setRemovingTag(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  return (
    <div className="space-y-3">
      {/* 当前标签 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="bg-secondary/50 text-foreground gap-1 pr-1"
            >
              {tag.tagValue}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.tagValue)}
                disabled={disabled || removingTag === tag.tagValue}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="添加自定义标签..."
          disabled={disabled || isAdding}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAddTag(inputValue)}
          disabled={disabled || isAdding || !inputValue.trim()}
          className="h-8 px-3"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* 预设标签建议 */}
      {availablePresetTags.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">快捷添加:</span>
          <div className="flex flex-wrap gap-1.5">
            {availablePresetTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddTag(tag)}
                disabled={disabled || isAdding}
                className="px-2 py-0.5 text-xs rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
