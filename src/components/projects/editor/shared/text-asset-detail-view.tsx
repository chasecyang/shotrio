"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Pencil,
  Eye,
  Edit3,
  Check,
  Copy,
  Tag as TagIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { AssetWithFullData, AssetTag } from "@/types/asset";
import { toast } from "sonner";
import { updateAsset } from "@/lib/actions/asset";
import { updateTextAssetContent } from "@/lib/actions/asset/text-asset";
import { TagEditor } from "./tag-editor";

interface TextAssetDetailViewProps {
  asset: AssetWithFullData;
  onBack: () => void;
  onAssetUpdated: () => void;
}

export function TextAssetDetailView({
  asset,
  onBack,
  onAssetUpdated,
}: TextAssetDetailViewProps) {
  // 编辑/预览模式
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(asset.textContent || "");
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [hasContentChanges, setHasContentChanges] = useState(false);

  // 名称编辑状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(asset.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 标签状态
  const [tags, setTags] = useState<AssetTag[]>(asset.tags || []);

  // 复制状态
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success("已复制到剪贴板");
    } catch (error) {
      console.error("复制失败:", error);
      toast.error("复制失败");
    }
  };

  // 同步 asset 变化到本地状态
  useEffect(() => {
    setEditedName(asset.name);
    setTags(asset.tags || []);
    setContent(asset.textContent || "");
    setHasContentChanges(false);
  }, [asset]);

  // 名称编辑聚焦
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // 内容变化检测
  useEffect(() => {
    setHasContentChanges(content !== (asset.textContent || ""));
  }, [content, asset.textContent]);

  // 保存名称
  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === asset.name) {
      setIsEditingName(false);
      setEditedName(asset.name);
      return;
    }

    setIsSavingName(true);
    try {
      const result = await updateAsset(asset.id, { name: editedName.trim() });
      if (result.success) {
        toast.success("名称已更新");
        setIsEditingName(false);
        onAssetUpdated();
      } else {
        toast.error(result.error || "更新失败");
        setEditedName(asset.name);
      }
    } catch (error) {
      console.error("更新名称失败:", error);
      toast.error("更新失败");
      setEditedName(asset.name);
    } finally {
      setIsSavingName(false);
    }
  };

  // 名称编辑键盘事件
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
      setEditedName(asset.name);
    }
  };

  // 保存内容
  const handleSaveContent = async () => {
    if (!hasContentChanges) return;

    setIsSavingContent(true);
    try {
      const result = await updateTextAssetContent(asset.id, content);
      if (result.success) {
        toast.success("内容已保存");
        setHasContentChanges(false);
        onAssetUpdated();
      } else {
        toast.error(result.error || "保存失败");
      }
    } catch (error) {
      console.error("保存内容失败:", error);
      toast.error("保存失败");
    } finally {
      setIsSavingContent(false);
    }
  };

  // 标签变化处理
  const handleTagsChange = (newTags: AssetTag[]) => {
    setTags(newTags);
    onAssetUpdated();
  };

  return (
    <div className="h-full flex flex-col">
      {/* 头部 - 返回按钮 */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：文本内容区 */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-muted/30 min-h-0">
          {/* 控制栏 - 预览/编辑切换 */}
          <div className="shrink-0 px-4 py-2.5 border-b bg-background/80 flex items-center gap-3">
            {/* 编辑/预览切换 */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
              <Button
                variant={isEditing ? "ghost" : "secondary"}
                size="sm"
                className="h-7 px-3 gap-1.5"
                onClick={() => setIsEditing(false)}
              >
                <Eye className="h-3.5 w-3.5" />
                预览
              </Button>
              <Button
                variant={isEditing ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 gap-1.5"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                编辑
              </Button>
            </div>
            {/* 保存按钮 */}
            {isEditing && hasContentChanges && (
              <Button
                size="sm"
                onClick={handleSaveContent}
                disabled={isSavingContent}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {isSavingContent ? "保存中..." : "保存"}
              </Button>
            )}
          </div>

          {isEditing ? (
            /* 编辑模式 */
            <div className="flex-1 flex flex-col p-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="支持 Markdown 语法...\n\n# 标题\n\n**粗体** *斜体*\n\n- 列表项"
                className="h-full resize-none font-mono text-sm bg-background"
              />
            </div>
          ) : (
            /* 预览模式 */
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6">
                {content ? (
                  <MarkdownRenderer content={content} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-50" />
                    <p>暂无内容</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* 底部状态栏 */}
          <div className="shrink-0 px-4 py-2 border-t bg-background/80 flex items-center justify-between text-xs text-muted-foreground">
            <span>{content.length} 字符</span>
            {hasContentChanges && (
              <span className="text-amber-500">有未保存的更改</span>
            )}
          </div>
        </div>

        {/* 右侧：信息面板 */}
        <div className="w-[360px] border-l flex flex-col bg-background min-h-0">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              {/* 名称和日期 */}
              <div className="space-y-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      ref={nameInputRef}
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={handleNameKeyDown}
                      onBlur={handleSaveName}
                      disabled={isSavingName}
                      className="h-8 text-base font-semibold"
                    />
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 group cursor-pointer"
                    onClick={() => setIsEditingName(true)}
                  >
                    <h3 className="text-base font-semibold truncate flex-1">
                      {asset.name}
                    </h3>
                    <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(asset.createdAt)}
                </div>
              </div>

              <Separator />

              {/* 标签编辑 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TagIcon className="h-4 w-4" />
                  <span>标签</span>
                </div>
                <TagEditor
                  assetId={asset.id}
                  tags={tags}
                  onTagsChange={handleTagsChange}
                />
              </div>

              <Separator />

              {/* 复制内容 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    <span>内容</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(content, "content")}
                    disabled={!content}
                  >
                    {copiedField === "content" ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  点击复制按钮复制全部内容
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
