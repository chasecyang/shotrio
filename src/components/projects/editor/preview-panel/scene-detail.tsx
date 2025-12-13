"use client";

import { useState, useEffect } from "react";
import { Scene, SceneImage } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Map, Image as ImageIcon, Eye, Grid3X3, FileText, Sparkles, RotateCw, AlertCircle, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  EditableField, 
  EditableInput, 
  EditableTextarea,
} from "@/components/ui/inline-editable-field";
import { useAutoSave } from "@/hooks/use-auto-save";
import { upsertScene, deleteScene } from "@/lib/actions/scene";
import { startMasterLayoutGeneration, startQuarterViewGeneration } from "@/lib/actions/scene/image";
import { useEditor } from "../editor-context";
import { getProjectDetail } from "@/lib/actions/project";
import { toast } from "sonner";

interface SceneDetailProps {
  scene: Scene & { images?: SceneImage[] };
}

interface FormData {
  name: string;
  description: string;
}

export function SceneDetail({ scene }: SceneDetailProps) {
  const { updateProject, selectResource } = useEditor();
  const images = scene.images || [];
  const masterLayout = images.find((img) => img.imageType === "master_layout");
  const quarterView = images.find((img) => img.imageType === "quarter_view");
  
  const [formData, setFormData] = useState<FormData>({
    name: scene.name,
    description: scene.description || "",
  });

  // 当场景切换时，重置表单数据
  useEffect(() => {
    setFormData({
      name: scene.name,
      description: scene.description || "",
    });
  }, [scene.id, scene.name, scene.description]);

  const [generatingMaster, setGeneratingMaster] = useState(false);
  const [generatingQuarter, setGeneratingQuarter] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 自动保存
  const { saveStatus } = useAutoSave({
    data: formData,
    originalData: {
      name: scene.name,
      description: scene.description || "",
    },
    onSave: async (data) => {
      const result = await upsertScene(scene.projectId, {
        id: scene.id,
        name: data.name,
        description: data.description || undefined,
      });
      
      // 刷新项目数据
      if (result.success) {
        const updatedProject = await getProjectDetail(scene.projectId);
        if (updatedProject) {
          updateProject(updatedProject);
        }
      }
      
      return result;
    },
  });

  // 生成全景布局图
  const handleGenerateMasterLayout = async () => {
    if (!formData.description) {
      toast.error("请先输入场景描述");
      return;
    }

    setGeneratingMaster(true);
    try {
      const result = await startMasterLayoutGeneration(scene.projectId, scene.id);
      if (result.success) {
        toast.success("已开始生成全景布局图，请稍后在任务中心查看进度");
      } else {
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("生成全景布局图失败");
    } finally {
      setGeneratingMaster(false);
    }
  };

  // 生成叙事视角图
  const handleGenerateQuarterView = async () => {
    if (!formData.description) {
      toast.error("请先输入场景描述");
      return;
    }

    if (!masterLayout?.imageUrl) {
      toast.error("请先完成全景布局图的生成");
      return;
    }

    setGeneratingQuarter(true);
    try {
      const result = await startQuarterViewGeneration(scene.projectId, scene.id);
      if (result.success) {
        toast.success("已开始生成叙事视角图，请稍后在任务中心查看进度");
      } else {
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("生成叙事视角图失败");
    } finally {
      setGeneratingQuarter(false);
    }
  };

  // 删除场景
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteScene(scene.projectId, scene.id);
      
      if (result.success) {
        toast.success("场景已删除");
        
        // 清除选中状态
        selectResource(null);
        
        // 刷新项目数据
        const updatedProject = await getProjectDetail(scene.projectId);
        if (updatedProject) {
          updateProject(updatedProject);
        }
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("删除场景失败");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };


  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* 头部 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Map className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="secondary">{images.length} 视角</Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* 场景名称 - 内联编辑 */}
          <EditableField
            label="场景名称"
            icon={Map}
            saveStatus={saveStatus}
          >
            <EditableInput
              value={formData.name}
              onChange={(name) => setFormData({ ...formData, name })}
              placeholder="输入场景名称"
              emptyText="点击输入场景名称"
              className="text-2xl font-semibold"
              inputClassName="text-2xl font-semibold h-auto py-1"
            />
          </EditableField>

          {/* 场景描述 - 内联编辑 */}
          <div className="mt-3">
            <EditableField
              label="场景描述"
              icon={FileText}
              tooltip="详细描述场景的氛围、环境特征、装饰风格、光线条件等，这个描述会作为 AI 生成场景图片的参考基础"
              saveStatus={saveStatus}
            >
              <EditableTextarea
                value={formData.description}
                onChange={(description) => setFormData({ ...formData, description })}
                placeholder="例如：一间温馨的咖啡厅内景，柔和的下午阳光透过落地窗洒进来，原木色的桌椅，墙上挂着复古海报..."
                emptyText="点击输入场景描述"
                minHeight="min-h-[80px]"
              />
            </EditableField>
          </div>
        </div>

        <Separator />

        {/* 提示信息 */}
        {!formData.description && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              请先输入场景描述，这样才能生成准确的场景图。
            </AlertDescription>
          </Alert>
        )}

        {/* 场景视角 */}
        <div className="space-y-6">
          {/* 全景布局图 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Grid3X3 className="w-4 h-4 text-muted-foreground" />
                全景布局图
              </div>
              {masterLayout?.imageUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateMasterLayout}
                  disabled={generatingMaster || !formData.description}
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-2 ${generatingMaster ? 'animate-spin' : ''}`} />
                  {generatingMaster ? "生成中..." : "重新生成"}
                </Button>
              )}
            </div>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border group">
              {masterLayout?.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={masterLayout.imageUrl}
                    alt="全景布局"
                    className="w-full h-full object-contain"
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground text-center">
                    建立空间认知，展示场景的完整布局和深度层次
                  </p>
                  <Button
                    onClick={handleGenerateMasterLayout}
                    disabled={generatingMaster || !formData.description}
                  >
                    <Sparkles className={`w-4 h-4 mr-2 ${generatingMaster ? 'animate-spin' : ''}`} />
                    {generatingMaster ? "生成中..." : "生成全景布局图"}
                  </Button>
                </div>
              )}
            </div>
            {masterLayout?.imagePrompt && (
              <p className="text-xs text-muted-foreground">
                {masterLayout.imagePrompt}
              </p>
            )}
          </div>

          {/* 叙事视角图 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Eye className="w-4 h-4 text-muted-foreground" />
                叙事视角图
              </div>
              {quarterView?.imageUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateQuarterView}
                  disabled={generatingQuarter || !formData.description || !masterLayout?.imageUrl}
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-2 ${generatingQuarter ? 'animate-spin' : ''}`} />
                  {generatingQuarter ? "生成中..." : "重新生成"}
                </Button>
              )}
            </div>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border group">
              {quarterView?.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={quarterView.imageUrl}
                    alt="叙事视角"
                    className="w-full h-full object-contain"
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground text-center">
                    叙事主力视角，展示场景的氛围和情感表达
                  </p>
                  <Button
                    onClick={handleGenerateQuarterView}
                    disabled={generatingQuarter || !formData.description || !masterLayout?.imageUrl}
                  >
                    <Sparkles className={`w-4 h-4 mr-2 ${generatingQuarter ? 'animate-spin' : ''}`} />
                    {generatingQuarter ? "生成中..." : "生成叙事视角图"}
                  </Button>
                  {!masterLayout?.imageUrl && formData.description && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                      请先完成全景布局图的生成
                    </p>
                  )}
                </div>
              )}
            </div>
            {quarterView?.imagePrompt && (
              <p className="text-xs text-muted-foreground">
                {quarterView.imagePrompt}
              </p>
            )}
          </div>
        </div>

        {images.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">暂无场景视角图</p>
            <p className="text-xs mt-1">可以在场景页面生成视角图</p>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除场景</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除场景 &ldquo;{scene.name}&rdquo; 吗？此操作无法撤销，所有关联的视角图片都将被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}

