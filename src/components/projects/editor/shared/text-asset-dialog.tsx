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
import { X, FileText } from "lucide-react";
import { toast } from "sonner";
import { createTextAsset, updateTextAssetContent } from "@/lib/actions/asset/text-asset";
import { updateAsset } from "@/lib/actions/asset/crud";
import type { AssetWithRuntimeStatus } from "@/types/asset";

interface TextAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  asset?: AssetWithRuntimeStatus; // 如果提供，则为编辑模式
  onSuccess?: () => void;
}

export function TextAssetDialog({
  open,
  onOpenChange,
  projectId,
  asset,
  onSuccess,
}: TextAssetDialogProps) {
  const isEditMode = !!asset;
  
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 编辑模式时初始化数据
  useEffect(() => {
    if (isEditMode && asset) {
      setName(asset.name);
      setContent(asset.textContent || "");
      setTags(asset.tags.map(t => t.tagValue));
    } else {
      // 新建模式时重置
      setName("");
      setContent("");
      setTags([]);
    }
  }, [isEditMode, asset, open]);

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

  const handleSubmit = async () => {
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
      if (isEditMode && asset) {
        // 更新模式
        const contentResult = await updateTextAssetContent(asset.id, content);
        if (!contentResult.success) {
          toast.error(contentResult.error || "更新内容失败");
          setIsSubmitting(false);
          return;
        }

        // 更新名称（如果有变化）
        if (name !== asset.name) {
          const nameResult = await updateAsset(asset.id, { name });
          if (!nameResult.success) {
            toast.error(nameResult.error || "更新名称失败");
            setIsSubmitting(false);
            return;
          }
        }

        toast.success("文本资产已更新");
      } else {
        // 创建模式
        const result = await createTextAsset({
          projectId,
          name: name.trim(),
          content,
          tags,
        });

        if (!result.success) {
          toast.error(result.error || "创建失败");
          setIsSubmitting(false);
          return;
        }

        toast.success("文本资产已创建");
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("提交失败:", error);
      toast.error("操作失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEditMode ? "编辑文本资产" : "创建文本资产"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
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

          {/* 标签输入（仅新建模式） */}
          {!isEditMode && (
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
          )}

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
                  placeholder="支持 Markdown 语法...\n\n# 标题\n\n**粗体** *斜体*\n\n- 列表项"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div className="min-h-[300px] border rounded-md p-4 bg-muted/30 overflow-auto">
                  <MarkdownRenderer content={content || "*暂无内容*"} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "保存中..." : isEditMode ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

