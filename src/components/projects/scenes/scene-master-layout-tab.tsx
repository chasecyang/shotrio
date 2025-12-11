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
  CheckCircle2,
  Maximize2,
  Film
} from "lucide-react";
import { 
  startMasterLayoutGeneration,
} from "@/lib/actions/scene";
import { toast } from "sonner";
import { ImagePreviewDialog } from "../characters/image-preview-dialog";
import { getSceneImageTypeName, getSceneImageTypeDescription } from "@/lib/prompts/scene";

interface SceneMasterLayoutTabProps {
  projectId: string;
  scene: Scene;
  masterLayout?: SceneImage;
}

export function SceneMasterLayoutTab({ 
  projectId, 
  scene, 
  masterLayout,
}: SceneMasterLayoutTabProps) {
  const [previewImage, setPreviewImage] = useState<SceneImage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const hasDescription = !!scene.description;

  // 开始生成全景布局图（后台任务）
  const handleGenerate = async () => {
    if (!hasDescription) {
      toast.error("请先在「基础信息」中添加场景描述");
      return;
    }

    const result = await startMasterLayoutGeneration(projectId, scene.id);
    if (result.success) {
      toast.success("已开始生成全景布局图，请稍后在任务中心查看进度");
    } else {
      toast.error(result.error || "创建任务失败");
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

      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Film className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold">
                {getSceneImageTypeName("master_layout")}
              </h3>
              {masterLayout && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              {getSceneImageTypeDescription("master_layout")}
            </p>
          </div>
        </div>

        <Card className="overflow-hidden border-2 border-blue-500/30">
          {masterLayout?.imageUrl ? (
            <div className="relative group">
              <div className="aspect-video bg-muted">
                <img 
                  src={masterLayout.imageUrl} 
                  alt="全景布局图"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPreviewImage(masterLayout);
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
          ) : (
            <div className="aspect-video bg-gradient-to-br from-blue-500/10 to-blue-500/5 flex flex-col items-center justify-center p-8 text-center">
              <Maximize2 className="w-16 h-16 text-blue-500/40 mb-4" />
              <h4 className="font-medium text-lg mb-2">生成全景布局图</h4>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Master Layout - 建立空间认知，展示场景的完整布局和深度层次
              </p>
              <Button 
                onClick={handleGenerate}
                disabled={!hasDescription}
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                生成全景布局图
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* 图片预览对话框 */}
      <ImagePreviewDialog 
        image={previewImage}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}

