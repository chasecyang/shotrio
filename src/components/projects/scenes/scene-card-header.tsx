import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SceneImage } from "@/types/project";
import { MapPin, Trash2, Sparkles } from "lucide-react";
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
  isHighlighted?: boolean;
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
  isHighlighted = false,
}: SceneCardHeaderProps) {
  const hasGeneratedImages = !!(masterLayout?.imageUrl || quarterView?.imageUrl);
  const totalImages = [masterLayout, quarterView].filter(Boolean).length;
  const generatedImages = [masterLayout, quarterView].filter(img => img?.imageUrl).length;

  return (
    <div className="relative border-b px-3 py-3 bg-muted/50">
      <div className="flex items-center justify-between gap-2">
        {/* 左侧：场景名称和标签 */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <EditableInput
            value={name}
            onChange={onNameChange}
            placeholder="场景名称"
            emptyText="点击输入场景名称"
            className="text-sm font-semibold"
            inputClassName="text-sm font-semibold h-7"
          />
          
          {/* 状态标签 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isHighlighted && (
              <Badge className="text-[10px] h-5 bg-gradient-to-r from-primary to-purple-500 text-white border-0 animate-pulse">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                新
              </Badge>
            )}
            {!hasDescription && (
              <Badge variant="secondary" className="text-[10px] h-5 bg-orange-500/90 text-white border-0">
                待设定
              </Badge>
            )}
            {totalImages > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-[10px] h-5 font-mono border-0 cursor-help",
                      hasGeneratedImages && generatedImages === totalImages
                        ? "bg-primary/90 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <MapPin className="w-2.5 h-2.5 mr-0.5" />
                    {generatedImages}/{totalImages}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div className="space-y-0.5">
                    <div>已生成：{generatedImages} 个场景图</div>
                    <div>待生成：{totalImages - generatedImages} 个场景图</div>
                    <div className="text-muted-foreground">总计：{totalImages} 个场景图</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {completionPercentage > 0 && (
              <Badge 
                variant="secondary" 
                className={cn(
                  "font-mono text-[10px] h-5 border-0",
                  completionPercentage === 100 
                    ? "bg-green-500/90 text-white" 
                    : completionPercentage === 50 
                    ? "bg-amber-500/90 text-white" 
                    : "bg-muted text-muted-foreground"
                )}
              >
                {completionPercentage}%
              </Badge>
            )}
          </div>
        </div>

        {/* 右侧：操作区 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <SaveStatusBadge status={saveStatus} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              删除场景
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

