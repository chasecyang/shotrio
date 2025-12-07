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
import { Character, CharacterImage } from "@/types/project";
import { 
  generateCharacterImages, 
  saveCharacterImage, 
  deleteCharacterImage,
  setCharacterPrimaryImage,
  generateImageForCharacterStyle,
  regenerateCharacterStyleImage
} from "@/lib/actions/character";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CharacterSettingsTab } from "./character-settings-tab";
import { ImagePreviewDialog } from "./image-preview-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CharacterDetailSheetProps {
  projectId: string;
  character: Character & { images: CharacterImage[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CharacterDetailSheet({
  projectId,
  character,
  open,
  onOpenChange,
}: CharacterDetailSheetProps) {
  const [activeTab, setActiveTab] = useState("settings");
  const hasImages = character.images && character.images.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0">
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle className="text-xl">{character.name}</SheetTitle>
                <Badge variant={hasImages ? "default" : "secondary"}>
                  {hasImages ? `${character.images.length} 个造型` : "未生成造型"}
                </Badge>
              </div>
              <SheetDescription className="line-clamp-2">
                {character.description || "完善角色设定，开始生成角色造型"}
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
                    角色设定
                  </TabsTrigger>
                  <TabsTrigger 
                    value="gallery" 
                    className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
                  >
                    造型管理
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="settings" className="flex-1 overflow-y-auto p-6 m-0">
                <CharacterSettingsTab 
                  projectId={projectId} 
                  character={character}
                  onSuccess={() => {
                    // 保存成功后自动切换到造型管理标签
                    if (!hasImages) {
                      setTimeout(() => setActiveTab("gallery"), 500);
                    }
                  }}
                />
              </TabsContent>

              <TabsContent value="gallery" className="flex-1 overflow-y-auto p-6 m-0">
                <CharacterGallery projectId={projectId} character={character} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ----------------------------------------------------------------------
// Sub-components for Gallery
// ----------------------------------------------------------------------

// 常用造型快捷选项
const PRESET_STYLES = [
  { label: "日常便装", prompt: "穿着休闲装，牛仔裤和T恤，轻松自在的表情" },
  { label: "正装", prompt: "穿着正式西装/职业装，专业干练的气质" },
  { label: "晚礼服", prompt: "穿着华丽晚礼服，优雅端庄的姿态" },
  { label: "运动装", prompt: "穿着运动服，充满活力的样子" },
  { label: "睡衣", prompt: "穿着舒适睡衣，放松慵懒的状态" },
  { label: "校服", prompt: "穿着校服制服，青春洋溢" },
];

function CharacterGallery({ projectId, character }: { projectId: string; character: Character & { images: CharacterImage[] } }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // New State Form
  const [newStateLabel, setNewStateLabel] = useState("");
  const [newStatePrompt, setNewStatePrompt] = useState("");
  
  // Preview dialog
  const [previewImage, setPreviewImage] = useState<CharacterImage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const hasBasicInfo = character.appearance || character.description;
  
  const handleGenerate = async () => {
    if (!newStateLabel) {
      toast.error("请先输入造型名称");
      return;
    }

    if (!hasBasicInfo) {
      toast.error("请先在「角色设定」页面完善基础信息");
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    setSelectedImage(null);

    // Construct the full prompt
    const baseAppearance = character.appearance || "";
    const stateDescription = newStatePrompt || newStateLabel;
    
    // 简单的组合 Prompt，实际项目中可能需要更复杂的 Prompt Engineering
    const finalPrompt = `Character Sheet, ${character.name}, ${baseAppearance}, ${stateDescription}, masterpiece, best quality, 8k`;

    try {
      const result = await generateCharacterImages(finalPrompt);
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

  const handlePresetClick = (preset: typeof PRESET_STYLES[0]) => {
    setNewStateLabel(preset.label);
    setNewStatePrompt(preset.prompt);
    toast.success(`已应用「${preset.label}」预设`);
  };

  const handleSaveImage = async () => {
    if (!selectedImage || !newStateLabel) return;

    try {
      const result = await saveCharacterImage(projectId, character.id, {
        label: newStateLabel,
        imageUrl: selectedImage,
        imagePrompt: newStatePrompt,
        isPrimary: character.images.length === 0, // 如果是第一张图，默认设为主图
      });

      if (result.success) {
        toast.success("造型已保存");
        // Reset form but keep gallery view updated (via parent revalidation)
        setGeneratedImages([]);
        setSelectedImage(null);
        setNewStateLabel("");
        setNewStatePrompt("");
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
            已保存的造型 ({character.images.length})
          </h3>
        </div>
        
        {character.images.length === 0 ? (
          <Alert className="border-dashed">
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              还没有生成造型。完善角色设定后，在下方开始生成第一个造型吧！
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {character.images.map((img) => (
              <CharacterImageCard 
                key={img.id} 
                image={img} 
                projectId={projectId}
                characterId={character.id}
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
          生成新造型
        </h3>

        {!hasBasicInfo && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              请先在「角色设定」页面完善角色的外貌描述，这样才能生成符合角色特征的造型。
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Presets */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">快速预设</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_STYLES.map((preset) => (
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
              <label className="text-xs font-medium text-muted-foreground">造型名称</label>
              <Input 
                placeholder="例如：居家服、晚礼服、战斗服" 
                value={newStateLabel}
                onChange={(e) => setNewStateLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
               <label className="text-xs font-medium text-muted-foreground">造型描述 (可选)</label>
               <Textarea 
                 placeholder="例如：穿着白色睡衣，头发凌乱，慵懒的表情" 
                 value={newStatePrompt}
                 onChange={(e) => setNewStatePrompt(e.target.value)}
                 className="resize-none h-20"
               />
               <p className="text-xs text-muted-foreground">
                 描述这个造型的服装、姿态、表情等细节，留空则只使用造型名称
               </p>
            </div>
          </div>
          
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !newStateLabel || !hasBasicInfo}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中，预计 30 秒...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> 生成造型图片
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {generatedImages.map((url, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "aspect-square rounded-md overflow-hidden cursor-pointer border-2 relative group transition-all",
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

function CharacterImageCard({ 
  image, 
  projectId,
  characterId,
  onPreview 
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

  const handleCopyPrompt = () => {
    if (image.imagePrompt) {
      navigator.clipboard.writeText(image.imagePrompt);
      toast.success("已复制描述到剪贴板");
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

  const handleRegenerate = async () => {
    if (!confirm("确定要重新生成这个造型的图片吗？")) return;
    
    try {
      const result = await regenerateCharacterStyleImage(projectId, characterId, image.id);
      if (result.success) {
        toast.success("已提交重新生成任务，请在任务中心查看进度");
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
          "aspect-square relative",
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
            {/* Hover overlay */}
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
