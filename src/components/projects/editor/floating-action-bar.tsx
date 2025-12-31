"use client";

import { Button } from "@/components/ui/button";
import { CheckSquare, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: () => void;
}

/**
 * 悬浮操作栏组件
 * 当选中素材时，在底部居中显示悬浮操作栏
 */
export function FloatingActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
}: FloatingActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "animate-in slide-in-from-bottom-4 fade-in duration-300"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-3 rounded-2xl",
          "bg-background/95 backdrop-blur-lg",
          "border shadow-xl",
          "transition-all duration-200"
        )}
      >
        {/* 已选数量显示 */}
        <div className="flex items-center gap-2 pr-3 border-r">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium text-foreground">
            已选择 <span className="text-primary font-semibold">{selectedCount}</span> 个素材
          </span>
        </div>

        {/* 操作按钮组 */}
        <div className="flex items-center gap-2">
          {/* 全选/取消全选按钮 */}
          {isAllSelected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeselectAll}
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Square className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">取消全选</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectAll}
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">全选</span>
            </Button>
          )}

          {/* 分隔线 */}
          <div className="w-px h-4 bg-border" />

          {/* 删除按钮 */}
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="h-8 gap-1.5 shadow-sm hover:shadow-md transition-shadow"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">删除</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

