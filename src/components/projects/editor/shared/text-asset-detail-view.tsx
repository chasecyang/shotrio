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
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

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
  const t = useTranslations("toasts");
  const tText = useTranslations("textAsset");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  // Edit/preview mode
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(asset.textContent || "");
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [hasContentChanges, setHasContentChanges] = useState(false);

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(asset.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Tags state
  const [tags, setTags] = useState<AssetTag[]>(asset.tags || []);

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(t("success.copied"));
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error(t("error.copyFailed"));
    }
  };

  // Sync asset changes to local state
  useEffect(() => {
    setEditedName(asset.name);
    setTags(asset.tags || []);
    setContent(asset.textContent || "");
    setHasContentChanges(false);
  }, [asset]);

  // Name editing focus
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Content change detection
  useEffect(() => {
    setHasContentChanges(content !== (asset.textContent || ""));
  }, [content, asset.textContent]);

  // Save name
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
        toast.success(t("success.nameUpdated"));
        setIsEditingName(false);
        onAssetUpdated();
      } else {
        toast.error(result.error || t("error.updateFailed"));
        setEditedName(asset.name);
      }
    } catch (error) {
      console.error("Failed to update name:", error);
      toast.error(t("error.updateFailed"));
      setEditedName(asset.name);
    } finally {
      setIsSavingName(false);
    }
  };

  // Name editing keyboard events
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
      setEditedName(asset.name);
    }
  };

  // Save content
  const handleSaveContent = async () => {
    if (!hasContentChanges) return;

    setIsSavingContent(true);
    try {
      const result = await updateTextAssetContent(asset.id, content);
      if (result.success) {
        toast.success(tText("contentSaved"));
        setHasContentChanges(false);
        onAssetUpdated();
      } else {
        toast.error(result.error || t("error.saveFailed"));
      }
    } catch (error) {
      console.error("Failed to save content:", error);
      toast.error(t("error.saveFailed"));
    } finally {
      setIsSavingContent(false);
    }
  };

  // Tags change handler
  const handleTagsChange = (newTags: AssetTag[]) => {
    setTags(newTags);
    onAssetUpdated();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - Back button */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon("back")}
        </Button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Text content area */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-muted/30 min-h-0">
          {/* Control bar - Preview/Edit toggle */}
          <div className="shrink-0 px-4 py-2.5 border-b bg-background/80 flex items-center gap-3">
            {/* Edit/Preview toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
              <Button
                variant={isEditing ? "ghost" : "secondary"}
                size="sm"
                className="h-7 px-3 gap-1.5"
                onClick={() => setIsEditing(false)}
              >
                <Eye className="h-3.5 w-3.5" />
                {tCommon("preview")}
              </Button>
              <Button
                variant={isEditing ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 gap-1.5"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                {tCommon("edit")}
              </Button>
            </div>
            {/* Save button */}
            {isEditing && hasContentChanges && (
              <Button
                size="sm"
                onClick={handleSaveContent}
                disabled={isSavingContent}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {isSavingContent ? tCommon("saving") : tCommon("save")}
              </Button>
            )}
          </div>

          {isEditing ? (
            /* Edit mode */
            <div className="flex-1 flex flex-col p-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={tText("markdownPlaceholder")}
                className="h-full resize-none font-mono text-sm bg-background"
              />
            </div>
          ) : (
            /* Preview mode */
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6">
                {content ? (
                  <MarkdownRenderer content={content} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-50" />
                    <p>{tText("noContent")}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Bottom status bar */}
          <div className="shrink-0 px-4 py-2 border-t bg-background/80 flex items-center justify-between text-xs text-muted-foreground">
            <span>{tText("characterCount", { count: content.length })}</span>
            {hasContentChanges && (
              <span className="text-amber-500">{tText("unsavedChanges")}</span>
            )}
          </div>
        </div>

        {/* Right: Info panel */}
        <div className="w-[360px] border-l flex flex-col bg-background min-h-0">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              {/* Name and date */}
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

              {/* Tag editing */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TagIcon className="h-4 w-4" />
                  <span>{tCommon("tags")}</span>
                </div>
                <TagEditor
                  assetId={asset.id}
                  tags={tags}
                  onTagsChange={handleTagsChange}
                />
              </div>

              <Separator />

              {/* Copy content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    <span>{tText("content")}</span>
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
                  {tText("copyHint")}
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
