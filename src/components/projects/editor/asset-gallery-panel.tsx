"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor } from "./editor-context";
import { AssetCard } from "./resource-panel/asset-card";
import { queryAssets, deleteAsset, deleteAssets } from "@/lib/actions/asset";
import { AssetWithTags } from "@/types/asset";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, Images, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetUploadDialog } from "./resource-panel/asset-upload-dialog";
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
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface AssetGalleryPanelProps {
  userId: string;
  onOpenAssetGeneration: () => void;
}

export function AssetGalleryPanel({ userId, onOpenAssetGeneration }: AssetGalleryPanelProps) {
  const { state } = useEditor();
  const { project } = state;

  const [assets, setAssets] = useState<AssetWithTags[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AssetWithTags | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

  // Lightbox 状态
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxAsset, setLightboxAsset] = useState<AssetWithTags | null>(null);

  // 加载素材
  const loadAssets = useCallback(async () => {
    if (!project?.id) return;

    setIsLoading(true);
    try {
      const result = await queryAssets({
        projectId: project.id,
        limit: 100,
      });
      setAssets(result.assets);
    } catch (error) {
      console.error("加载素材失败:", error);
      toast.error("加载素材失败");
    } finally {
      setIsLoading(false);
    }
  }, [project?.id]);

  // 初始加载
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // 监听素材创建事件
  useEffect(() => {
    const handleAssetCreated = () => {
      loadAssets();
    };

    window.addEventListener("asset-created", handleAssetCreated);
    return () => {
      window.removeEventListener("asset-created", handleAssetCreated);
    };
  }, [loadAssets]);

  // 处理素材点击 - 打开 Lightbox
  const handleAssetClick = (asset: AssetWithTags) => {
    setLightboxAsset(asset);
    setLightboxOpen(true);
  };

  // 处理删除
  const handleDelete = (asset: AssetWithTags) => {
    if (selectedAssetIds.size > 0) {
      return;
    }
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedAssetIds.size === 0) return;
    setDeleteDialogOpen(true);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      let result;
      let deletedIds: string[] = [];

      if (selectedAssetIds.size > 0) {
        deletedIds = Array.from(selectedAssetIds);
        result = await deleteAssets(deletedIds);
      } else if (assetToDelete) {
        deletedIds = [assetToDelete.id];
        result = await deleteAsset(assetToDelete.id);
      } else {
        return;
      }

      if (result.success) {
        const count = deletedIds.length;
        toast.success(`已删除 ${count} 个素材`);
        setSelectedAssetIds(new Set());
        await loadAssets();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error("删除素材失败:", error);
      toast.error("删除失败");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    }
  };

  // 选择/取消选择素材
  const handleSelectChange = (assetId: string, selected: boolean) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(assetId);
      } else {
        next.delete(assetId);
      }
      return next;
    });
  };

  // 处理上传成功
  const handleUploadSuccess = () => {
    loadAssets();
  };

  if (!project) return null;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Images className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">素材库</h3>
          <span className="text-xs text-muted-foreground">({assets.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            上传
          </Button>
          <Button size="sm" onClick={onOpenAssetGeneration}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            AI 生成
          </Button>
        </div>
      </div>

      {/* 素材网格 */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                <Images className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-2">暂无素材</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                开始创作第一个素材，可以使用 AI 生成或上传本地文件
              </p>
              <div className="flex gap-2">
                <Button onClick={onOpenAssetGeneration} size="sm">
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  AI 生成
                </Button>
                <Button onClick={() => setUploadDialogOpen(true)} variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-1.5" />
                  上传素材
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              }}
            >
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  viewMode="grid"
                  isSelected={false}
                  isBatchSelected={selectedAssetIds.has(asset.id)}
                  onDelete={handleDelete}
                  onClick={handleAssetClick}
                  onSelectChange={handleSelectChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 上传对话框 */}
      <AssetUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        projectId={project.id}
        userId={userId}
        onSuccess={handleUploadSuccess}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAssetIds.size > 0
                ? `确定要删除 ${selectedAssetIds.size} 个素材吗？此操作无法撤销。`
                : `确定要删除素材 "${assetToDelete?.name}" 吗？此操作无法撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox */}
      {lightboxAsset && (
        <ImageLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          src={lightboxAsset.imageUrl || ""}
          alt={lightboxAsset.name}
          downloadFilename={lightboxAsset.name}
        />
      )}
    </div>
  );
}

