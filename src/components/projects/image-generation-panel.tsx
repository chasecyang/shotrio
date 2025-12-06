"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import {
  generateCharacterImage,
  generateSceneImage,
  editCharacterImage,
} from "@/lib/actions/image-generation-actions";
import type { AspectRatio, Resolution } from "@/lib/services/fal.service";

interface GeneratedImageData {
  url: string;
  r2Key?: string;
}

export function ImageGenerationPanel() {
  const [activeTab, setActiveTab] = useState<"character" | "scene" | "edit">("character");
  
  // 文生图状态
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  const [resolution, setResolution] = useState<Resolution>("2K");
  const [numImages, setNumImages] = useState(1);
  
  // 图生图状态
  const [editPrompt, setEditPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  
  // 生成结果
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageData[]>([]);
  const [description, setDescription] = useState("");

  // 生成角色图像
  const handleGenerateCharacter = async () => {
    if (!prompt.trim()) {
      toast.error("请输入角色描述");
      return;
    }

    setLoading(true);
    setGeneratedImages([]);
    
    try {
      const result = await generateCharacterImage({
        characterDescription: prompt,
        aspectRatio,
        resolution,
        numImages,
      });

      if (result.success && result.images) {
        setGeneratedImages(result.images);
        setDescription(result.description || "");
        toast.success(`成功生成 ${result.images.length} 张图像`);
      } else {
        toast.error(result.error || "生成失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 生成场景图像
  const handleGenerateScene = async () => {
    if (!prompt.trim()) {
      toast.error("请输入场景描述");
      return;
    }

    setLoading(true);
    setGeneratedImages([]);
    
    try {
      const result = await generateSceneImage({
        description: prompt,
        aspectRatio,
        resolution,
        numImages,
      });

      if (result.success && result.images) {
        setGeneratedImages(result.images);
        setDescription(result.description || "");
        toast.success(`成功生成 ${result.images.length} 张图像`);
      } else {
        toast.error(result.error || "生成失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 编辑图像
  const handleEditImage = async () => {
    if (!editPrompt.trim()) {
      toast.error("请输入编辑指令");
      return;
    }

    if (referenceImages.length === 0) {
      toast.error("请先选择参考图像");
      return;
    }

    setLoading(true);
    setGeneratedImages([]);
    
    try {
      const result = await editCharacterImage({
        originalImageUrls: referenceImages,
        editPrompt,
        aspectRatio: "auto",
        resolution,
        numImages: 1,
      });

      if (result.success && result.images) {
        setGeneratedImages(result.images);
        setDescription(result.description || "");
        toast.success("编辑成功");
      } else {
        toast.error(result.error || "编辑失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("编辑失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 添加已生成的图片作为参考图
  const addAsReference = (url: string) => {
    if (referenceImages.includes(url)) {
      toast.info("该图片已添加");
      return;
    }
    setReferenceImages([...referenceImages, url]);
    setActiveTab("edit");
    toast.success("已添加为参考图");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 左侧：生成控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI 图像生成
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="character">角色</TabsTrigger>
              <TabsTrigger value="scene">场景</TabsTrigger>
              <TabsTrigger value="edit">编辑</TabsTrigger>
            </TabsList>

            {/* 角色生成 */}
            <TabsContent value="character" className="space-y-4">
              <div>
                <Label htmlFor="character-prompt">角色描述</Label>
                <Textarea
                  id="character-prompt"
                  placeholder="例如：一位30岁的亚洲女性，短发，专业装扮，自信的表情，摄影棚灯光..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="aspect-ratio">宽高比</Label>
                  <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                    <SelectTrigger id="aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3:4">3:4 (竖版)</SelectItem>
                      <SelectItem value="1:1">1:1 (方形)</SelectItem>
                      <SelectItem value="4:3">4:3 (横版)</SelectItem>
                      <SelectItem value="16:9">16:9 (宽屏)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="resolution">分辨率</Label>
                  <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)}>
                    <SelectTrigger id="resolution">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1K">1K (预览)</SelectItem>
                      <SelectItem value="2K">2K (推荐)</SelectItem>
                      <SelectItem value="4K">4K (高质量)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="num-images">生成数量</Label>
                <Select value={numImages.toString()} onValueChange={(v) => setNumImages(parseInt(v))}>
                  <SelectTrigger id="num-images">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 张</SelectItem>
                    <SelectItem value="2">2 张</SelectItem>
                    <SelectItem value="4">4 张</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerateCharacter}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    生成角色
                  </>
                )}
              </Button>
            </TabsContent>

            {/* 场景生成 */}
            <TabsContent value="scene" className="space-y-4">
              <div>
                <Label htmlFor="scene-prompt">场景描述</Label>
                <Textarea
                  id="scene-prompt"
                  placeholder="例如：一个现代咖啡厅内部，下午时分，温暖的自然光从落地窗洒入..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scene-aspect-ratio">宽高比</Label>
                  <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                    <SelectTrigger id="scene-aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (宽屏)</SelectItem>
                      <SelectItem value="21:9">21:9 (超宽)</SelectItem>
                      <SelectItem value="4:3">4:3 (标准)</SelectItem>
                      <SelectItem value="1:1">1:1 (方形)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="scene-resolution">分辨率</Label>
                  <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)}>
                    <SelectTrigger id="scene-resolution">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1K">1K (预览)</SelectItem>
                      <SelectItem value="2K">2K (推荐)</SelectItem>
                      <SelectItem value="4K">4K (高质量)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleGenerateScene}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    生成场景
                  </>
                )}
              </Button>
            </TabsContent>

            {/* 图像编辑 */}
            <TabsContent value="edit" className="space-y-4">
              <div>
                <Label>参考图像 ({referenceImages.length}/14)</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {referenceImages.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                      <Image
                        src={url}
                        alt={`Reference ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => setReferenceImages(referenceImages.filter((_, i) => i !== idx))}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
                {referenceImages.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    从生成结果中添加参考图，或在下方输入图片 URL
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="edit-prompt">编辑指令</Label>
                <Textarea
                  id="edit-prompt"
                  placeholder="例如：将发色改为棕色，添加眼镜，调整光照更加柔和..."
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="edit-resolution">分辨率</Label>
                <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)}>
                  <SelectTrigger id="edit-resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1K">1K (预览)</SelectItem>
                    <SelectItem value="2K">2K (推荐)</SelectItem>
                    <SelectItem value="4K">4K (高质量)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleEditImage}
                disabled={loading || referenceImages.length === 0}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    编辑中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    编辑图像
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 右侧：生成结果 */}
      <Card>
        <CardHeader>
          <CardTitle>生成结果</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">AI 正在生成图像...</p>
              </div>
            </div>
          )}

          {!loading && generatedImages.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  暂无生成结果
                </p>
              </div>
            </div>
          )}

          {!loading && generatedImages.length > 0 && (
            <div className="space-y-4">
              {description && (
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {description}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {generatedImages.map((img, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="relative aspect-square rounded-lg overflow-hidden border">
                      <Image
                        src={img.url}
                        alt={`Generated ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => addAsReference(img.url)}
                      >
                        用于编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          // 这里可以添加保存到角色的逻辑
                          toast.success("已保存");
                        }}
                      >
                        保存
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

