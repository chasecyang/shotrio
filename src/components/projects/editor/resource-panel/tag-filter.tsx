"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, X } from "lucide-react";
import { PRESET_TAGS, isPresetTag } from "@/lib/constants/asset-tags";
import { cn } from "@/lib/utils";

interface TagFilterProps {
  selectedTags: string[];  // 简化为字符串数组
  onChange: (tags: string[]) => void;
  availableTags: { tagValue: string; count: number }[];  // 简化结构
}

export function TagFilter({
  selectedTags,
  onChange,
  availableTags,
}: TagFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggleTag = (tagValue: string) => {
    const exists = selectedTags.includes(tagValue);

    if (exists) {
      onChange(selectedTags.filter((t) => t !== tagValue));
    } else {
      onChange([...selectedTags, tagValue]);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const isTagSelected = (tagValue: string) => {
    return selectedTags.includes(tagValue);
  };

  // 分离预设标签和自定义标签
  const presetTagsData = availableTags.filter(tag => 
    isPresetTag(tag.tagValue)
  );
  const customTagsData = availableTags.filter(tag => 
    !isPresetTag(tag.tagValue)
  );

  // 按标签值排序
  presetTagsData.sort((a, b) => {
    const presetOrder = PRESET_TAGS.indexOf(a.tagValue as typeof PRESET_TAGS[number]);
    const presetOrderB = PRESET_TAGS.indexOf(b.tagValue as typeof PRESET_TAGS[number]);
    return presetOrder - presetOrderB;
  });
  customTagsData.sort((a, b) => a.tagValue.localeCompare(b.tagValue));

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5",
              selectedTags.length > 0 && "border-primary"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            {selectedTags.length === 0 ? "按类型筛选" : "筛选"}
            {selectedTags.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 text-xs">
                {selectedTags.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <h4 className="text-sm font-medium">按类型筛选</h4>
              <p className="text-xs text-muted-foreground mt-0.5">角色 / 场景 / 道具</p>
            </div>
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleClearAll}
              >
                清除全部
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-[400px]">
            <div className="p-2">
              {availableTags.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-1">暂无可用标签</p>
                  <p className="text-xs text-muted-foreground">
                    创建素材时可以添加角色、场景、道具等标签
                  </p>
                </div>
              ) : (
                <>
                  {/* 预设标签 */}
                  {presetTagsData.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                        类型标签（角色 / 场景 / 道具）
                      </h5>
                      <div className="space-y-1">
                        {presetTagsData.map((tag) => (
                          <label
                            key={tag.tagValue}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={isTagSelected(tag.tagValue)}
                              onCheckedChange={() => handleToggleTag(tag.tagValue)}
                            />
                            <span className="text-sm flex-1">{tag.tagValue}</span>
                            <span className="text-xs text-muted-foreground">
                              {tag.count}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 自定义标签 */}
                  {customTagsData.length > 0 && (
                    <div className="mb-0">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                        自定义标签
                      </h5>
                      <div className="space-y-1">
                        {customTagsData.map((tag) => (
                          <label
                            key={tag.tagValue}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={isTagSelected(tag.tagValue)}
                              onCheckedChange={() => handleToggleTag(tag.tagValue)}
                            />
                            <span className="text-sm flex-1">{tag.tagValue}</span>
                            <span className="text-xs text-muted-foreground">
                              {tag.count}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* 显示已选中的标签 */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {selectedTags.map((tagValue, index) => (
            <Badge
              key={`${tagValue}-${index}`}
              variant={isPresetTag(tagValue) ? "default" : "secondary"}
              className="gap-1 pl-2 pr-1"
            >
              <span className="text-xs">{tagValue}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 hover:bg-transparent"
                onClick={() => handleToggleTag(tagValue)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

