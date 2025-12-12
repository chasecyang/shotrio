import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharacterImage } from "@/types/project";
import { Eye, ImageIcon, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface CharacterImageDisplayProps {
  image: CharacterImage;
  styleLabel: string;
  projectId: string;
  characterId: string;
  isPending: boolean;
  isGenerating?: boolean;
  onPreview: () => void;
  onSetPrimary: () => void;
  onGenerate: () => void;
}

export function CharacterImageDisplay({
  image,
  styleLabel,
  isPending,
  isGenerating = false,
  onPreview,
  onSetPrimary,
  onGenerate,
}: CharacterImageDisplayProps) {
  const hasImage = !!image.imageUrl;

  return (
    <div className="space-y-1.5">
      <div 
        className={cn(
          "relative aspect-square rounded-lg overflow-hidden border",
          hasImage 
            ? "border-border bg-muted cursor-pointer hover:border-primary/50 transition-colors group" 
            : "border-dashed border-muted-foreground/30 bg-muted/30"
        )}
        onClick={hasImage ? onPreview : undefined}
      >
        {hasImage ? (
          <>
            <img
              src={image.imageUrl || ""}
              alt={styleLabel}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {image.isPrimary && (
              <div className="absolute top-2 left-2">
                <Badge className="text-[10px] h-5 bg-primary/90 text-white border-0">
                  <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
                  主图
                </Badge>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="absolute inset-0 flex items-center justify-center">
                <Eye className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <ImageIcon className="w-12 h-12 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground mb-2.5 text-center">
              暂无图片
            </p>
            <Button size="sm" onClick={onGenerate}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              生成图片
            </Button>
          </div>
        )}
      </div>

      {hasImage && (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onPreview}
            className="flex-1 h-7 text-xs"
          >
            <Eye className="w-3 h-3 mr-1" />
            查看
          </Button>
          {!image.isPrimary && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSetPrimary}
              disabled={isPending}
              className="flex-1 h-7 text-xs"
            >
              <Star className="w-3 h-3 mr-1" />
              设为主图
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerate}
            disabled={isGenerating || isPending}
            className="flex-1 h-7 text-xs"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {isGenerating ? "生成中..." : "重新生成"}
          </Button>
        </div>
      )}
    </div>
  );
}
