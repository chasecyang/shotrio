"use client";

import { useState } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  Trash2, 
  Sparkles, 
  Check, 
  Image as ImageIcon,
  MoreVertical,
  Star,
  Copy,
  Eye,
  Lightbulb
} from "lucide-react";
import { Scene, SceneImage } from "@/types/project";
import { 
  generateSceneImages, 
  saveSceneImage, 
  deleteSceneImage,
  setScenePrimaryImage,
  generateImageForSceneView,
  regenerateSceneViewImage
} from "@/lib/actions/scene";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SceneSettingsTab } from "./scene-settings-tab";
import { ImagePreviewDialog } from "../characters/image-preview-dialog";

interface SceneDetailSheetProps {
  projectId: string;
  scene: Scene & { images: SceneImage[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SceneDetailSheet({
  projectId,
  scene,
  open,
  onOpenChange,
}: SceneDetailSheetProps) {
  const [activeTab, setActiveTab] = useState("settings");
  const hasImages = scene.images && scene.images.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0">
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle className="text-xl">{scene.name}</SheetTitle>
                <Badge variant={hasImages ? "default" : "secondary"}>
                  {hasImages ? `${scene.images.length} 个视角` : "未生成图片"}
                </Badge>
              </div>
              <SheetDescription className="line-clamp-2">
                {scene.description || "完善场景设定，开始生成场景参考图"}
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="px-6 border-b bg-muted/20">
                <TabsList className="w-full justify-start h-12 bg-transparent p-0">
                  <TabsTrigger 
                    value="settings" 
                    className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
                  >
                    场景设定
                  </TabsTrigger>
                  <TabsTrigger 
                    value="gallery" 
                    className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
                  >
                    视角管理
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="settings" className="flex-1 overflow-y-auto p-6 m-0">
                <SceneSettingsTab 
                  projectId={projectId} 
                  scene={scene}
                  onSuccess={() => {
                    if (!hasImages) {
                      setTimeout(() => setActiveTab("gallery"), 500);
                    }
                  }}
                />
              </TabsContent>

              <TabsContent value="gallery" className="flex-1 overflow-y-auto p-6 m-0">
                <SceneGallery projectId={projectId} scene={scene} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// 常用场景视角预设
const PRESET_VIEWS = [
  { label: "全景", prompt: "wide establishing shot, showing the entire location, cinematic composition" },
  { label: "正面视角", prompt: "front view, eye-level perspective, balanced composition" },
  { label: "侧面视角", prompt: "side angle view, profile perspective, depth of field" },
  { label: "鸟瞰图", prompt: "bird's eye view, top-down perspective, aerial shot" },
  { label: "仰视图", prompt: "low angle shot, looking up, dramatic perspective" },
  { label: "特写", prompt: "close-up detail shot, focusing on key elements and textures" },
];

function SceneGallery({ projectId, scene }: { projectId: string; scene: Scene & { images: SceneImage[] } }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const [newViewLabel, setNewViewLabel] = useState("");
  const [newViewPrompt, setNewViewPrompt] = useState("");
  
  const [previewImage, setPreviewImage] = useState<SceneImage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const hasBasicInfo = scene.description || scene.name;
  
  const handleGenerate = async () => {
    if (!newViewLabel) {
      toast.error("请先输入视角名称");
      return;
    }

    if (!hasBasicInfo) {
      toast.error("请先在「场景设定」页面完善基础信息");
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    setSelectedImage(null);

    const sceneDescription = scene.description || "";
    const location = scene.location || "";
    const timeOfDay = scene.timeOfDay || "";
    const viewDescription = newViewPrompt || newViewLabel;
    
    const fullPrompt = `Cinematic location concept art: ${scene.name}. 
${sceneDescription}. 
View: ${viewDescription}. 
Setting: ${location}, ${timeOfDay} lighting. 
Establishing shot of the location, professional film production design, highly detailed environment, atmospheric lighting, masterpiece quality, 8k.`;

    try {
      const result = await generateSceneImages(fullPrompt, "16:9", 4);
      if (result.success && result.images) {
        setGeneratedImages(result.images);
        toast.success("生成完成！请选择一张保存");
      } else {
        toast.error(result.error || "生成失败");
      }
    } catch {
      toast.error("生成出错");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePresetClick = (preset: typeof PRESET_VIEWS[0]) => {
    setNewViewLabel(preset.label);
    setNewViewPrompt(preset.prompt);
    toast.success(`已应用「${preset.label}」预设`);
  };

  const handleSaveImage = async () => {
    if (!selectedImage || !newViewLabel) return;

    try {
      const result = await saveSceneImage(projectId, scene.id, {
        label: newViewLabel,
        imageUrl: selectedImage,
        imagePrompt: newViewPrompt,
        isPrimary: scene.images.length === 0,
      });

      if (result.success) {
        toast.success("视角已保存");
        setGeneratedImages([]);
        setSelectedImage(null);
        setNewViewLabel("");
        setNewViewPrompt("");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("保存失败");
    }
  };

  return (
    <div className="space-y-8">
      {/* Existing Images Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            已保存的视角 ({scene.images.length})
          </h3>
        </div>
        
        {scene.images.length === 0 ? (
          <Alert className="border-dashed">
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              还没有生成视角图。完善场景设定后，在下方开始生成第一个视角吧！
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {scene.images.map((img) => (
              <SceneImageCard 
                key={img.id} 
                image={img} 
                projectId={projectId}
                sceneId={scene.id}
                onPreview={() => {
                  setPreviewImage(img);
                  setPreviewOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Generation Area */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          生成新视角
        </h3>

        {!hasBasicInfo && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              请先在「场景设定」页面完善场景的基本描述，这样才能生成准确的场景图。
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Presets */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">快速预设</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_VIEWS.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(preset)}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="grid gap-4 p-4 border rounded-lg bg-muted/10">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">视角名称</label>
              <Input 
                placeholder="例如：全景、正面视角、鸟瞰图" 
                value={newViewLabel}
                onChange={(e) => setNewViewLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">视角描述 (可选)</label>
              <Textarea 
                placeholder="例如：wide establishing shot, cinematic composition" 
                value={newViewPrompt}
                onChange={(e) => setNewViewPrompt(e.target.value)}
                className="resize-none h-20"
              />
              <p className="text-xs text-muted-foreground">
                描述拍摄角度、构图方式等，留空则只使用视角名称
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !newViewLabel || !hasBasicInfo}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中，预计 30 秒...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> 生成场景图片
              </>
            )}
          </Button>
        </div>

        {/* Generation Results */}
        {generatedImages.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">生成结果 (请选择一张保存)</h4>
              {selectedImage && (
                <Button size="sm" onClick={handleSaveImage}>
                  <Check className="mr-2 h-4 w-4" /> 确认保存
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {generatedImages.map((url, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "aspect-video rounded-md overflow-hidden cursor-pointer border-2 relative group transition-all",
                    selectedImage === url ? "border-primary ring-2 ring-primary ring-offset-2 scale-[0.98]" : "border-muted hover:border-primary/50 hover:scale-[0.98]"
                  )}
                  onClick={() => setSelectedImage(url)}
                >
                  <img src={url} alt="generated" className="w-full h-full object-cover" />
                  {selectedImage === url && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="bg-primary rounded-full p-2">
                        <Check className="w-6 h-6 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <ImagePreviewDialog 
        image={previewImage}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}

function SceneImageCard({ 
  image, 
  projectId,
  sceneId,
  onPreview 
}: { 
  image: SceneImage; 
  projectId: string;
  sceneId: string;
  onPreview: () => void;
}) {
  const hasImage = image.imageUrl !== null;

  const handleDelete = async () => {
    if (!confirm(`确定要删除「${image.label}」吗？`)) return;
    
    try {
      await deleteSceneImage(projectId, image.id);
      toast.success("已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  const handleSetPrimary = async () => {
    try {
      await setScenePrimaryImage(projectId, sceneId, image.id);
      toast.success("已设为主图");
    } catch {
      toast.error("设置失败");
    }
  };

  const handleCopyPrompt = () => {
    if (image.imagePrompt) {
      navigator.clipboard.writeText(image.imagePrompt);
      toast.success("已复制描述到剪贴板");
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await generateImageForSceneView(projectId, sceneId, image.id);
      if (result.success) {
        toast.success("已提交图片生成任务，请在后台任务查看进度");
      } else {
        toast.error(result.error || "提交任务失败");
      }
    } catch {
      toast.error("提交任务出错");
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("确定要重新生成这个视角的图片吗？")) return;
    
    try {
      const result = await regenerateSceneViewImage(projectId, sceneId, image.id);
      if (result.success) {
        toast.success("已提交重新生成任务，请在后台任务查看进度");
      } else {
        toast.error(result.error || "提交任务失败");
      }
    } catch {
      toast.error("提交任务出错");
    }
  };

  return (
    <div className="group relative rounded-lg overflow-hidden border bg-background hover:shadow-md transition-shadow">
      <div 
        className={cn(
          "aspect-video relative",
          hasImage && "cursor-pointer"
        )}
        onClick={hasImage ? onPreview : undefined}
      >
        {hasImage ? (
          <>
            <img src={image.imageUrl || ""} alt={image.label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
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
            <Button 
              size="sm" 
              onClick={handleGenerate}
              className="mt-2"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              生成图片
            </Button>
            <p className="text-xs text-muted-foreground mt-2 px-2 text-center">
              已有描述
            </p>
          </div>
        )}
      </div>
      <div className="p-2 flex items-center justify-between">
        <span className="text-sm font-medium truncate" title={image.label}>{image.label}</span>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasImage && (
              <DropdownMenuItem onClick={onPreview}>
                <Eye className="mr-2 h-3 w-3" /> 查看大图
              </DropdownMenuItem>
            )}
            {image.imagePrompt && (
              <DropdownMenuItem onClick={handleCopyPrompt}>
                <Copy className="mr-2 h-3 w-3" /> 复制描述
              </DropdownMenuItem>
            )}
            {hasImage ? (
              <>
                <DropdownMenuItem onClick={handleRegenerate}>
                  <Sparkles className="mr-2 h-3 w-3" /> 重新生成
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSetPrimary} disabled={image.isPrimary || false}>
                  <Star className="mr-2 h-3 w-3" /> 设为主图
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={handleGenerate}>
                <Sparkles className="mr-2 h-3 w-3" /> 生成图片
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-3 w-3" /> 删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
