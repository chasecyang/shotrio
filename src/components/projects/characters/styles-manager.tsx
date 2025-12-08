"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Character, CharacterImage } from "@/types/project";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Plus, Loader2, Image as ImageIcon, Sparkles, MoreVertical, Trash2, Eye, Star } from "lucide-react";
import { createCharacterStyle, deleteCharacterImage, setCharacterPrimaryImage, generateImageForCharacterStyle } from "@/lib/actions/character";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ImagePreviewDialog } from "./image-preview-dialog";

interface StylesManagerProps {
  projectId: string;
  character: Character & { images: CharacterImage[] };
  hasBasicInfo: boolean;
  jobs: Partial<{
    type?: string;
    status?: string;
    inputData?: string;
    projectId?: string;
    progress?: number;
    progressMessage?: string;
  }>[];
  onPreview: (image: CharacterImage) => void;
}

/**
 * 造型管理器组件 - 简化版网格布局
 */
export function StylesManager({
  projectId,
  character,
  hasBasicInfo,
  jobs,
  onPreview,
}: StylesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreatingStyle, setIsCreatingStyle] = useState(false);
  const [previewImage, setPreviewImage] = useState<CharacterImage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleCreateStyle = async () => {
    if (!hasBasicInfo) {
      toast.error("请先完善角色的外貌描述");
      return;
    }

    setIsCreatingStyle(true);
    try {
      // 生成默认名称
      const styleCount = character.images.length + 1;
      const defaultLabel = `造型 ${styleCount}`;
      const defaultPrompt = `角色的第 ${styleCount} 个造型`;

      console.log("📝 开始创建造型...");
      const result = await createCharacterStyle(projectId, character.id, {
        label: defaultLabel,
        stylePrompt: defaultPrompt,
      });

      console.log("📥 创建结果:", result);

      if (result.success && result.imageId) {
        console.log("✅ 创建成功，准备刷新页面");
        toast.success("造型已创建");
        // 使用 startTransition 包装 router.refresh，确保状态更新正确
        startTransition(() => {
          console.log("🔄 开始刷新页面...");
          router.refresh();
        });
        setIsCreatingStyle(false);
        console.log("🎉 状态已重置");
      } else {
        toast.error(result.error || "创建失败");
        setIsCreatingStyle(false);
      }
    } catch (error) {
      toast.error("创建失败");
      console.error(error);
      setIsCreatingStyle(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 标题和创建按钮 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          造型列表 ({character.images.length})
        </h3>
        <Button
          onClick={handleCreateStyle}
          disabled={!hasBasicInfo || isCreatingStyle || isPending}
          size="sm"
        >
          {isCreatingStyle || isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              创建中...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              新建造型
            </>
          )}
        </Button>
      </div>

      {!hasBasicInfo && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            请先在「基本信息」标签完善角色的外貌描述，才能创建造型。
          </AlertDescription>
        </Alert>
      )}

      {/* 造型网格 */}
      {character.images.length === 0 ? (
        <Alert className="border-dashed">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            还没有造型。完善角色的外貌描述后，点击上方按钮创建第一个造型吧！
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {character.images.map((image) => (
            <StyleCard
              key={image.id}
              image={image}
              projectId={projectId}
              characterId={character.id}
              onPreview={() => {
                setPreviewImage(image);
                setPreviewOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* 预览对话框 */}
      <ImagePreviewDialog
        image={previewImage}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}

// 造型卡片组件
function StyleCard({
  image,
  projectId,
  characterId,
  onPreview,
}: {
  image: CharacterImage;
  projectId: string;
  characterId: string;
  onPreview: () => void;
}) {
  const hasImage = image.imageUrl !== null;

  const handleDelete = async () => {
    if (!confirm(`确定要删除「${image.label}」吗？`)) return;

    try {
      await deleteCharacterImage(projectId, image.id);
      toast.success("已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  const handleSetPrimary = async () => {
    try {
      await setCharacterPrimaryImage(projectId, characterId, image.id);
      toast.success("已设为主图");
    } catch {
      toast.error("设置失败");
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await generateImageForCharacterStyle(projectId, characterId, image.id);
      if (result.success) {
        toast.success("已提交图片生成任务，请在任务中心查看进度");
      } else {
        toast.error(result.error || "提交任务失败");
      }
    } catch {
      toast.error("提交任务出错");
    }
  };

  return (
    <div className="group relative rounded-lg overflow-hidden border bg-background hover:shadow-md transition-shadow flex flex-col lg:flex-row">
      {/* 图片区域 - 窄屏时较小，宽屏时恢复正常 */}
      <div
        className={cn(
          "relative aspect-video lg:aspect-square lg:w-40 shrink-0",
          hasImage && "cursor-pointer"
        )}
        onClick={hasImage ? onPreview : undefined}
      >
        {hasImage ? (
          <>
            <img
              src={image.imageUrl || ""}
              alt={image.label}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {image.isPrimary && (
              <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full flex items-center shadow-sm">
                <Star className="w-3 h-3 mr-1 fill-current" /> 主图
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Eye className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-dashed border-muted-foreground/20">
            <ImageIcon className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <Button size="sm" onClick={handleGenerate} className="mt-2">
              <Sparkles className="w-3 h-3 mr-1" />
              生成图片
            </Button>
            <p className="text-xs text-muted-foreground mt-2 px-2 text-center">
              已有描述
            </p>
          </div>
        )}
      </div>

      {/* 信息区域 - 响应式布局 */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* 造型名称 */}
        <h4 className="text-sm font-semibold truncate" title={image.label}>
          {image.label}
        </h4>

        {/* 造型描述 */}
        {image.imagePrompt && (
          <p className="text-xs text-muted-foreground line-clamp-2" title={image.imagePrompt}>
            {image.imagePrompt}
          </p>
        )}

        {/* 功能按钮组 */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {hasImage ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onPreview}
                className="flex-1 h-7 text-xs min-w-[70px]"
              >
                <Eye className="w-3 h-3 mr-1" />
                查看
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSetPrimary}
                disabled={image.isPrimary || false}
                className="flex-1 h-7 text-xs min-w-[70px]"
              >
                <Star className="w-3 h-3 mr-1" />
                {image.isPrimary ? "主图" : "设为主图"}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              className="flex-1 h-7 text-xs"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              生成图片
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs min-w-[60px]"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            删除
          </Button>
        </div>
      </div>
    </div>
  );
}
