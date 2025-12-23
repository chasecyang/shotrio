"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  Edit,
  Trash2,
  Copy,
  Calendar,
  Tag,
  TrendingUp,
  Image as ImageIcon,
  X,
  Plus,
  Check,
  ChevronsUpDown,
  Maximize2,
} from "lucide-react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { AssetWithTags, hasAssetTag } from "@/types/asset";
import { updateAsset, deleteAsset } from "@/lib/actions/asset";
import { addAssetTag, removeAssetTag } from "@/lib/actions/asset";
import { PRESET_TAGS, isPresetTag } from "@/lib/constants/asset-tags";
import { toast } from "sonner";
import Image from "next/image";

interface AssetDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetWithTags | null;
  onDerive: (asset: AssetWithTags) => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

export function AssetDetailDialog({
  open,
  onOpenChange,
  asset,
  onDerive,
  onDeleted,
  onUpdated,
}: AssetDetailDialogProps) {
  const tToast = useTranslations("toasts");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const [tagComboOpen, setTagComboOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (asset) {
      setEditedName(asset.name);
    }
  }, [asset]);

  if (!asset) return null;

  // 获取可用的预设标签（排除已添加的）
  const availablePresetTags = PRESET_TAGS.filter(
    tag => !hasAssetTag(asset, tag)
  );

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === asset.name) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateAsset(asset.id, { name: editedName.trim() });
      if (result.success) {
        toast.success(tToast("success.nameUpdated"));
        setIsEditingName(false);
        if (onUpdated) {
          onUpdated();
        }
      } else {
        toast.error(result.error || "更新失败");
      }
    } catch (error) {
      console.error(error);
      toast.error(tToast("error.updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteAsset(asset.id);
      if (result.success) {
        toast.success(tToast("success.assetDeleted"));
        setShowDeleteDialog(false);
        onOpenChange(false);
        if (onDeleted) {
          onDeleted();
        }
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error(error);
      toast.error(tToast("error.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddTag = async (tagValue: string) => {
    if (!tagValue.trim()) return;

    try {
      const result = await addAssetTag({
        assetId: asset.id,
        tagValue: tagValue.trim(),
      });

      if (result.success) {
        toast.success(tToast("success.tagAdded"));
        setNewTagValue("");
        setTagComboOpen(false);
        if (onUpdated) {
          onUpdated();
        }
      } else {
        toast.error(result.error || "添加失败");
      }
    } catch (error) {
      console.error(error);
      toast.error(tToast("error.addTagFailed"));
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const result = await removeAssetTag(tagId);
      if (result.success) {
        toast.success(tToast("success.tagRemoved"));
        if (onUpdated) {
          onUpdated();
        }
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error(error);
      toast.error(tToast("error.removeTagFailed"));
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveName();
                        } else if (e.key === "Escape") {
                          setEditedName(asset.name);
                          setIsEditingName(false);
                        }
                      }}
                      disabled={isSaving}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      disabled={isSaving}
                    >
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditedName(asset.name);
                        setIsEditingName(false);
                      }}
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-lg">{asset.name}</DialogTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setIsEditingName(true)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDerive(asset)}
                >
                  <Copy className="h-4 w-4 mr-1.5" />
                  派生
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 py-4">
              {/* 图片预览 */}
              <div 
                className="relative aspect-video rounded-xl overflow-hidden border bg-muted group cursor-pointer"
                onClick={() => setLightboxOpen(true)}
              >
                <Image
                  src={asset.imageUrl}
                  alt={asset.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 700px) 100vw, 700px"
                />
                {/* 悬停遮罩 */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex items-center gap-2 text-white">
                    <Maximize2 className="h-5 w-5" />
                    <span className="text-sm font-medium">查看大图</span>
                  </div>
                </div>
              </div>
              {/* Lightbox */}
              <ImageLightbox
                open={lightboxOpen}
                onOpenChange={setLightboxOpen}
                src={asset.imageUrl}
                alt={asset.name}
                downloadFilename={`${asset.name}.png`}
              />

              {/* 基本信息 */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  基本信息
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      使用次数:
                    </span>
                    <span className="ml-2 font-medium">{asset.usageCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      创建时间:
                    </span>
                    <span className="ml-2">{formatDate(asset.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* 生成信息 */}
              {(asset.prompt || asset.modelUsed || asset.seed) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">生成信息</h3>
                    {asset.prompt && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Prompt
                        </Label>
                        <p className="text-sm mt-1 p-3 rounded-lg bg-muted/50">
                          {asset.prompt}
                        </p>
                      </div>
                    )}
                    {asset.modelUsed && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          模型
                        </Label>
                        <p className="text-sm mt-1">{asset.modelUsed}</p>
                      </div>
                    )}
                    {asset.seed !== null && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Seed
                        </Label>
                        <p className="text-sm mt-1 font-mono">{asset.seed}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 标签 */}
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  标签
                </h3>
                <div className="flex flex-wrap gap-2">
                  {asset.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={isPresetTag(tag.tagValue) ? "default" : "secondary"}
                      className="gap-1.5 pl-2.5 pr-1"
                    >
                      <span className="text-xs">{tag.tagValue}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto w-auto p-0.5 hover:bg-transparent hover:text-destructive"
                        onClick={() => handleRemoveTag(tag.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>

                {/* 添加标签 - Combobox */}
                <Popover open={tagComboOpen} onOpenChange={setTagComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={tagComboOpen}
                      className="w-full justify-between"
                      size="sm"
                    >
                      <span className="text-muted-foreground">添加标签...</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="搜索或输入自定义标签..." 
                        value={newTagValue}
                        onValueChange={setNewTagValue}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="py-2 px-3">
                            <p className="text-sm text-muted-foreground mb-2">
                              未找到匹配标签
                            </p>
                            {newTagValue.trim() && (
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleAddTag(newTagValue.trim())}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                创建 &quot;{newTagValue.trim()}&quot;
                              </Button>
                            )}
                          </div>
                        </CommandEmpty>
                        {availablePresetTags.length > 0 && (
                          <CommandGroup heading="预设标签">
                            {availablePresetTags.map((tag) => (
                              <CommandItem
                                key={tag}
                                value={tag}
                                onSelect={() => handleAddTag(tag)}
                              >
                                <Check className="mr-2 h-4 w-4 opacity-0" />
                                {tag}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {newTagValue.trim() && !PRESET_TAGS.includes(newTagValue.trim() as typeof PRESET_TAGS[number]) && (
                          <CommandGroup heading="自定义">
                            <CommandItem
                              value={newTagValue.trim()}
                              onSelect={() => handleAddTag(newTagValue.trim())}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              添加 &quot;{newTagValue.trim()}&quot;
                            </CommandItem>
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 派生关系 */}
              {asset.sourceAsset && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">派生来源</h3>
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                        <Image
                          src={
                            asset.sourceAsset.thumbnailUrl ||
                            asset.sourceAsset.imageUrl
                          }
                          alt={asset.sourceAsset.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {asset.sourceAsset.name}
                        </p>
                        {asset.derivationType && (
                          <p className="text-xs text-muted-foreground">
                            派生类型: {asset.derivationType}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除素材「{asset.name}」吗？此操作无法撤销。
              {asset.usageCount > 0 && (
                <span className="block mt-2 text-yellow-600 dark:text-yellow-500">
                  警告：此素材已被使用 {asset.usageCount} 次，删除后相关引用将失效。
                </span>
              )}
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
    </>
  );
}

