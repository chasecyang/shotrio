"use client";

import { useState } from "react";
import { Scene, SceneImage } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Sparkles, 
  Eye, 
  RotateCw, 
  Lock, 
  CheckCircle2,
  Camera
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SceneImageCandidatesDialog } from "./scene-image-candidates-dialog";
import { 
  generateQuarterView,
  saveQuarterView,
} from "@/lib/actions/scene";
import { toast } from "sonner";
import { ImagePreviewDialog } from "../characters/image-preview-dialog";
import { getSceneImageTypeName, getSceneImageTypeDescription } from "@/lib/prompts/scene";

interface SceneQuarterViewTabProps {
  projectId: string;
  scene: Scene;
  masterLayout?: SceneImage;
  quarterView?: SceneImage;
}

export function SceneQuarterViewTab({ 
  projectId, 
  scene, 
  masterLayout,
  quarterView,
}: SceneQuarterViewTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [previewImage, setPreviewImage] = useState<SceneImage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const hasDescription = !!scene.description;
  const isLocked = !masterLayout;

  // 生成 Quarter View
  const handleGenerate = async () => {
    if (!hasDescription) {
      toast.error("请先在「基础信息」中添加场景描述");
      return;
    }

    if (!masterLayout) {
      toast.error("请先完成 Master Layout");
      return;
    }

    setIsGenerating(true);
    setShowDialog(true);
    setCandidates([]);

    try {
      const result = await generateQuarterView(projectId, scene.id);
      if (result.success && result.images) {
        setCandidates(result.images);
        toast.success("图片生成成功，请选择一张");
      } else {
        toast.error(result.error || "生成失败");
        setShowDialog(false);
      }
    } catch (error) {
      toast.error("生成失败");
      setShowDialog(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // 保存 Quarter View
  const handleSave = async (imageUrl: string) => {
    const result = await saveQuarterView(projectId, scene.id, imageUrl);
    if (result.success) {
      toast.success("45° View 已保存");
    } else {
      toast.error(result.error || "保存失败");
      throw new Error(result.error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {!hasDescription && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            请先在「基础信息」页面添加场景描述，这样才能生成准确的场景图。
          </AlertDescription>
        </Alert>
      )}

      {isLocked && hasDescription && (
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            请先在「Master Layout」标签页完成全景布局图的生成。
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                masterLayout ? "bg-orange-500/20" : "bg-muted"
              )}>
                <Camera className={cn(
                  "w-4 h-4",
                  masterLayout ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
                )} />
              </div>
              <h3 className={cn(
                "text-lg font-semibold",
                !masterLayout && "text-muted-foreground"
              )}>
                {getSceneImageTypeName("quarter_view")}
              </h3>
              {isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
              {quarterView && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              {getSceneImageTypeDescription("quarter_view")}
            </p>
          </div>
        </div>

        <Card className={cn(
          "overflow-hidden border-2",
          masterLayout ? "border-orange-500/30" : "border-muted"
        )}>
          {quarterView?.imageUrl ? (
            <div className="relative group">
              <div className="aspect-video bg-muted">
                <img 
                  src={quarterView.imageUrl} 
                  alt="45° View"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPreviewImage(quarterView);
                      setPreviewOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    查看大图
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleGenerate}
                  >
                    <RotateCw className="w-4 h-4 mr-2" />
                    重新生成
                  </Button>
                </div>
              </div>
            </div>
          ) : masterLayout ? (
            <div className="aspect-video bg-gradient-to-br from-orange-500/10 to-orange-500/5 flex flex-col items-center justify-center p-8 text-center">
              <Camera className="w-16 h-16 text-orange-500/40 mb-4" />
              <h4 className="font-medium text-lg mb-2">生成叙事主力视角</h4>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                90% 的对话和动作镜头都将使用这个角度
              </p>
              <Button 
                onClick={handleGenerate}
                disabled={!hasDescription}
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                生成 45° View
              </Button>
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-muted/50 to-muted/20 flex flex-col items-center justify-center p-8 text-center">
              <Lock className="w-16 h-16 text-muted-foreground/40 mb-4" />
              <h4 className="font-medium text-lg mb-2 text-muted-foreground">
                待解锁
              </h4>
              <p className="text-sm text-muted-foreground max-w-md">
                请先完成 Master Layout 的生成
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* 候选图片对话框 */}
      <SceneImageCandidatesDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title="选择 45° View"
        description="请选择最适合作为叙事主力视角的一张图片"
        images={candidates}
        isGenerating={isGenerating}
        onSelect={handleSave}
      />

      {/* 图片预览对话框 */}
      <ImagePreviewDialog 
        image={previewImage}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}

