"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ShotAssetWithAsset } from "@/types/project";
import { AssetWithTags } from "@/types/asset";
import { ShotAssetLabelEditor } from "./shot-asset-label-editor";
import {
  Plus,
  Trash2,
  GripVertical,
  Star,
  ImageIcon,
  Loader2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { removeShotAsset, reorderShotAssets, addShotAsset, updateShotAssetLabel } from "@/lib/actions/project/shot-asset";
import { queryAssets } from "@/lib/actions/asset";
import { toast } from "sonner";
import { MAX_SHOT_ASSETS } from "@/lib/constants/shot-asset-labels";

interface ShotAssetGalleryProps {
  shotId: string;
  projectId: string;
  shotAssets: ShotAssetWithAsset[];
  onUpdate: () => void;
  maxAssets?: number;
}

interface SortableAssetCardProps {
  shotAsset: ShotAssetWithAsset;
  index: number;
  onRemove: (id: string) => void;
  onLabelUpdate: (id: string, label: string) => Promise<void>;
  isUpdating: boolean;
}

function SortableAssetCard({
  shotAsset,
  index,
  onRemove,
  onLabelUpdate,
  isUpdating,
}: SortableAssetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shotAsset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isFirst = index === 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group flex-shrink-0 w-40 rounded-lg border bg-card overflow-hidden",
        isDragging && "opacity-50 z-50"
      )}
    >
      {/* 拖拽手柄 */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1 bg-background/80 backdrop-blur-sm rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        disabled={isUpdating}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </button>

      {/* 主图标识 */}
      {isFirst && (
        <Badge
          variant="default"
          className="absolute top-2 right-2 z-10 gap-1 text-[10px] px-1.5 py-0.5"
        >
          <Star className="w-2.5 h-2.5 fill-current" />
          主图
        </Badge>
      )}

      {/* 图片预览 */}
      <div className="aspect-video bg-muted relative">
        {shotAsset.asset?.imageUrl ? (
          <Image
            src={shotAsset.asset.imageUrl}
            alt={shotAsset.label}
            fill
            className="object-cover"
            sizes="160px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* 信息区 */}
      <div className="p-2 space-y-1">
        {/* Label 编辑器 */}
        <div className="flex items-center justify-between">
          <ShotAssetLabelEditor
            currentLabel={shotAsset.label}
            onSave={(newLabel) => onLabelUpdate(shotAsset.id, newLabel)}
            disabled={isUpdating}
          />
        </div>

        {/* 删除按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(shotAsset.id)}
          disabled={isUpdating}
          className="w-full h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          移除
        </Button>
      </div>
    </div>
  );
}

export function ShotAssetGallery({
  shotId,
  projectId,
  shotAssets,
  onUpdate,
  maxAssets = MAX_SHOT_ASSETS,
}: ShotAssetGalleryProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [assets, setAssets] = useState<AssetWithTags[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const canAddMore = shotAssets.length < maxAssets;

  // 加载素材列表
  const loadAssets = async () => {
    setIsLoadingAssets(true);
    try {
      const result = await queryAssets({
        projectId,
        limit: 100,
      });
      setAssets(result.assets);
    } catch (error) {
      console.error("加载素材失败:", error);
      toast.error("加载素材失败");
    } finally {
      setIsLoadingAssets(false);
    }
  };

  const handleOpenAssetSelector = () => {
    setIsAssetSelectorOpen(true);
    loadAssets();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = shotAssets.findIndex((item) => item.id === active.id);
    const newIndex = shotAssets.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedAssets = arrayMove(shotAssets, oldIndex, newIndex);

    setIsUpdating(true);
    try {
      const assetOrders = reorderedAssets.map((item, index) => ({
        id: item.id,
        order: index,
      }));

      const result = await reorderShotAssets({
        shotId,
        assetOrders,
      });

      if (result.success) {
        toast.success("排序已更新");
        onUpdate();
      } else {
        toast.error(result.error || "排序失败");
      }
    } catch (error) {
      console.error("排序失败:", error);
      toast.error("排序失败");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmRemove = async () => {
    if (!deleteConfirmId) return;

    setIsUpdating(true);
    try {
      const result = await removeShotAsset(deleteConfirmId);
      if (result.success) {
        toast.success("已移除素材");
        onUpdate();
      } else {
        toast.error(result.error || "移除失败");
      }
    } catch (error) {
      console.error("移除失败:", error);
      toast.error("移除失败");
    } finally {
      setIsUpdating(false);
      setDeleteConfirmId(null);
    }
  };

  const handleLabelUpdate = async (id: string, newLabel: string) => {
    try {
      const result = await updateShotAssetLabel({ id, label: newLabel });
      if (result.success) {
        toast.success("标签已更新");
        onUpdate();
      } else {
        toast.error(result.error || "更新失败");
      }
    } catch (error) {
      console.error("更新标签失败:", error);
      toast.error("更新标签失败");
    }
  };

  const handleSelectAsset = async (assetId: string) => {
    setIsUpdating(true);
    try {
      const defaultLabel = shotAssets.length === 0 ? "首帧" : "参考图";
      const result = await addShotAsset({
        shotId,
        assetId,
        label: defaultLabel,
      });

      if (result.success) {
        toast.success("已添加素材");
        onUpdate();
        setIsAssetSelectorOpen(false);
      } else {
        toast.error(result.error || "添加失败");
      }
    } catch (error) {
      console.error("添加失败:", error);
      toast.error("添加失败");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 已关联的素材ID集合
  const linkedAssetIds = new Set(shotAssets.map((sa) => sa.assetId));

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">关联图片</h3>
            <Badge variant="secondary" className="text-xs">
              {shotAssets.length}/{maxAssets}
            </Badge>
          </div>
        </div>

        {/* 图片画廊 */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={shotAssets.map((item) => item.id)}
            strategy={horizontalListSortingStrategy}
          >
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-2">
                {shotAssets.map((shotAsset, index) => (
                  <SortableAssetCard
                    key={shotAsset.id}
                    shotAsset={shotAsset}
                    index={index}
                    onRemove={handleRemove}
                    onLabelUpdate={handleLabelUpdate}
                    isUpdating={isUpdating}
                  />
                ))}

                {/* 添加按钮 */}
                {canAddMore && (
                  <button
                    onClick={handleOpenAssetSelector}
                    disabled={isUpdating}
                    className={cn(
                      "flex-shrink-0 w-40 aspect-[16/11] rounded-lg border-2 border-dashed",
                      "flex flex-col items-center justify-center gap-2",
                      "hover:bg-accent hover:border-primary/50 transition-colors",
                      "text-muted-foreground hover:text-foreground",
                      isUpdating && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Plus className="w-6 h-6" />
                    <span className="text-xs">添加图片</span>
                  </button>
                )}

                {!canAddMore && (
                  <div className="flex-shrink-0 w-40 aspect-[16/11] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
                    <span className="text-xs">已达上限</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </SortableContext>
        </DndContext>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要移除这张图片吗？此操作不会删除素材本身，只是取消关联。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>确认移除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 素材选择器对话框 */}
      <Dialog open={isAssetSelectorOpen} onOpenChange={setIsAssetSelectorOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>选择素材</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 搜索框 */}
            <div>
              <input
                type="text"
                placeholder="搜索素材..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>

            {/* 素材列表 */}
            <ScrollArea className="h-[400px]">
              {isLoadingAssets ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无可用素材</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {filteredAssets.map((asset) => {
                    const isLinked = linkedAssetIds.has(asset.id);
                    return (
                      <button
                        key={asset.id}
                        onClick={() => !isUpdating && !isLinked && handleSelectAsset(asset.id)}
                        disabled={!asset.imageUrl || isUpdating || isLinked}
                        className={cn(
                          "relative group aspect-square rounded-lg overflow-hidden border-2 transition-all",
                          isLinked
                            ? "border-green-500 opacity-50 cursor-not-allowed"
                            : "border-transparent hover:border-primary",
                          !asset.imageUrl && "opacity-50 cursor-not-allowed",
                          isUpdating && "cursor-wait"
                        )}
                      >
                        {asset.imageUrl ? (
                          <Image
                            src={asset.imageUrl}
                            alt={asset.name}
                            fill
                            className="object-cover"
                            sizes="200px"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        )}

                        {isLinked && (
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <Badge variant="default" className="bg-green-500">
                              已关联
                            </Badge>
                          </div>
                        )}

                        {/* 名称 */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-xs text-white truncate">{asset.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

