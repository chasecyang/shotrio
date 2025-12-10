import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SceneImage } from "@/types/project";
import { MapPin, MoreHorizontal, Trash2 } from "lucide-react";
import { EditableInput, SaveStatusBadge, SaveStatus } from "@/components/ui/inline-editable-field";
import { cn } from "@/lib/utils";

interface SceneCardHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  masterLayout?: SceneImage;
  quarterView?: SceneImage;
  hasDescription: boolean;
  completionPercentage: number;
  saveStatus: SaveStatus;
  onDelete: () => void;
}

export function SceneCardHeader({
  name,
  onNameChange,
  masterLayout,
  quarterView,
  hasDescription,
  completionPercentage,
  saveStatus,
  onDelete,
}: SceneCardHeaderProps) {
  // 优先显示 quarter_view，如果没有则显示 master_layout
  const displayImage = quarterView || masterLayout;

  return (
    <div className="relative overflow-hidden">
      {/* 背景图片 */}
      <div className="aspect-video bg-gradient-to-br from-muted/80 to-muted relative">
        {displayImage?.imageUrl ? (
          <img 
            src={displayImage.imageUrl} 
            alt={name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}
        
        {/* 渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        
        {/* 完成度徽章 */}
        <div className="absolute top-3 right-3">
          <Badge 
            variant="secondary" 
            className={cn(
              "font-mono text-xs backdrop-blur-sm border-0",
              completionPercentage === 100 
                ? "bg-green-500/90 text-white" 
                : completionPercentage === 50 
                ? "bg-amber-500/90 text-white" 
                : "bg-muted/90"
            )}
          >
            {completionPercentage}%
          </Badge>
        </div>
        
        {/* 场景名称和操作 */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <EditableInput
                value={name}
                onChange={onNameChange}
                placeholder="场景名称"
                emptyText="点击输入场景名称"
                className="text-lg font-bold text-white drop-shadow-lg"
                inputClassName="text-lg font-bold text-white bg-black/30 backdrop-blur-sm border-white/30 placeholder:text-white/60"
              />
              {!hasDescription && (
                <p className="text-xs text-white/80 mt-1 drop-shadow">
                  点击「基础信息」添加场景描述
                </p>
              )}
            </div>
            
            {/* 右侧操作 */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <SaveStatusBadge status={saveStatus} className="backdrop-blur-sm" />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-8 w-8 bg-white/90 hover:bg-white backdrop-blur-sm"
                  >
                    <MoreHorizontal className="h-4 w-4 text-black" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> 删除场景
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

