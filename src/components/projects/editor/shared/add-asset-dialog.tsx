"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { X, FileText, Image, Film, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createTextAsset } from "@/lib/actions/asset/text-asset";

interface AddAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
  onOpenAIGeneration?: () => void;
}

export function AddAssetDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
  onOpenAIGeneration,
}: AddAssetDialogProps) {
  const [activeTab, setActiveTab] = useState("text");
  
  // 文本创建相关状态
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"markdown" | "plain">("markdown");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 重置表单
  const resetForm = () => {
    setName("");
    setContent("");
    setFormat("markdown");
    setTags([]);
    setTagInput("");
  };

  // 对话框关闭时重置
  useEffect(() => {
    if (!open) {
      resetForm();
      setActiveTab("text");
    }
  }, [open]);

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTextAssetSubmit = async () => {
    if (!name.trim()) {
      toast.error("请输入资产名称");
      return;
    }

    if (!content.trim()) {
      toast.error("请输入文本内容");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createTextAsset({
        projectId,
        name: name.trim(),
        content,
        format,
        tags,
      });

      if (!result.success) {
        toast.error(result.error || "创建失败");
        setIsSubmitting(false);
        return;
      }

      toast.success("文本资产已创建");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("提交失败:", error);
      toast.error("操作失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAIGeneration = () => {
    onOpenChange(false);
    onOpenAIGeneration?.();
  };

  // 根据不同 tab 动态设置对话框宽度
  const dialogWidth = activeTab === "text" ? "max-w-4xl" : "max-w-2xl";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${dialogWidth} max-h-[90vh] overflow-hidden flex flex-col`}>
        <DialogHeader>
          <DialogTitle>添加素材</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="text" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span>文本</span>
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1.5">
              <Image className="h-4 w-4" />
              <span>图片</span>
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-1.5">
              <Film className="h-4 w-4" />
              <span>视频</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span>AI生成</span>
            </TabsTrigger>
          </TabsList>

          {/* 文本选项卡 */}
          <TabsContent value="text" className="flex-1 overflow-y-auto space-y-4 mt-0">
            {/* 名称输入 */}
            <div className="space-y-2">
              <Label htmlFor="name">资产名称</Label>
              <Input
                id="name"
                placeholder="例如：张三角色小传"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* 格式选择 */}
            <div className="space-y-2">
              <Label>文本格式</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={format === "markdown" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("markdown")}
                >
                  Markdown
                </Button>
                <Button
                  type="button"
                  variant={format === "plain" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("plain")}
                >
                  纯文本
                </Button>
              </div>
            </div>

            {/* 标签输入 */}
            <div className="space-y-2">
              <Label htmlFor="tags">标签</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="输入标签后按回车"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  添加
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 内容编辑器 */}
            <div className="space-y-2">
              <Label>内容</Label>
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit">编辑</TabsTrigger>
                  <TabsTrigger value="preview">预览</TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="mt-2">
                  <Textarea
                    placeholder={
                      format === "markdown"
                        ? "支持 Markdown 语法...\n\n# 标题\n\n**粗体** *斜体*\n\n- 列表项"
                        : "输入文本内容..."
                    }
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-2">
                  <div className="min-h-[300px] border rounded-md p-4 bg-muted/30 overflow-auto">
                    {format === "markdown" ? (
                      <MarkdownRenderer content={content || "*暂无内容*"} />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm">
                        {content || "暂无内容"}
                      </pre>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* 图片选项卡 - 占位 */}
          <TabsContent value="image" className="flex-1 flex items-center justify-center mt-0">
            <div className="text-center space-y-4 py-12">
              <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                <Image className="w-10 h-10 text-muted-foreground/60" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                  图片上传
                  <Badge variant="secondary" className="text-xs">即将推出</Badge>
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  即将支持图片素材上传功能，敬请期待
                </p>
              </div>
            </div>
          </TabsContent>

          {/* 视频选项卡 - 占位 */}
          <TabsContent value="video" className="flex-1 flex items-center justify-center mt-0">
            <div className="text-center space-y-4 py-12">
              <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                <Film className="w-10 h-10 text-muted-foreground/60" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                  视频上传
                  <Badge variant="secondary" className="text-xs">即将推出</Badge>
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  即将支持视频素材上传功能，敬请期待
                </p>
              </div>
            </div>
          </TabsContent>

          {/* AI生成选项卡 */}
          <TabsContent value="ai" className="flex-1 flex items-center justify-center mt-0">
            <div className="text-center space-y-6 py-12">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">AI 生成素材</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  使用 AI 快速生成图片和视频素材，只需描述你的创意想法
                </p>
              </div>
              <Button onClick={handleOpenAIGeneration} size="lg" className="mt-4">
                <Sparkles className="w-4 h-4 mr-2" />
                开始 AI 生成
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer - 只在文本选项卡显示 */}
        {activeTab === "text" && (
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleTextAssetSubmit} disabled={isSubmitting}>
              {isSubmitting ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

