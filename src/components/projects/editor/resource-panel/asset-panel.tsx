"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor } from "../editor-context";
import { AssetList } from "./asset-list";
import { AssetToolbar } from "./asset-toolbar";
import { AssetUploadDialog } from "./asset-upload-dialog";
import { queryAssets, deleteAsset, deleteAssets } from "@/lib/actions/asset";
import { AssetWithTags } from "@/types/asset";
import { toast } from "sonner";
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
import { MediaViewer } from "@/components/ui/media-viewer";

interface AssetPanelProps {
  userId: string;
}

export function AssetPanel({ userId }: AssetPanelProps) {
  const { state, jobs } = useEditor();
  const { project } = state;

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [assets, setAssets] = useState<AssetWithTags[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);  // 简化为字符串数组
  const [availableTags, setAvailableTags] = useState<
    { tagValue: string; count: number }[]  // 简化结构
  >([]);

  // 对话框状态
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AssetWithTags | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 批量选择状态
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

  // 媒体查看器状态
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerAsset, setViewerAsset] = useState<AssetWithTags | null>(null);

  // 加载素材
  const loadAssets = useCallback(async () => {
    if (!project?.id) return;

    setIsLoading(true);
    try {
      const result = await queryAssets({
        projectId: project.id,
        tagFilters: selectedTags.length > 0 ? selectedTags : undefined,
        limit: 100,
      });

      setAssets(result.assets);

      // 计算可用标签及其数量
      const tagMap = new Map<string, number>();
      result.assets.forEach((asset) => {
        asset.tags.forEach((tag) => {
          const value = tag.tagValue;
          tagMap.set(value, (tagMap.get(value) || 0) + 1);
        });
      });

      const tags = Array.from(tagMap.entries()).map(([tagValue, count]) => {
        return { tagValue, count };
      });

      setAvailableTags(tags);
    } catch (error) {
      console.error("加载素材失败:", error);
      toast.error("加载素材失败");
    } finally {
      setIsLoading(false);
    }
  }, [project?.id, selectedTags]);

  // 初始加载和标签筛选变化时重新加载
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // 监听素材创建事件，自动刷新列表
  useEffect(() => {
    const handleAssetCreated = () => {
      loadAssets();
    };

    window.addEventListener("asset-created", handleAssetCreated);
    return () => {
      window.removeEventListener("asset-created", handleAssetCreated);
    };
  }, [loadAssets]);

  // 处理素材点击 - 打开媒体查看器
  const handleAssetClick = (asset: AssetWithTags) => {
    setViewerAsset(asset);
    setViewerOpen(true);
  };

  // 处理删除 - 显示确认对话框（单个删除）
  const handleDelete = (asset: AssetWithTags) => {
    // 如果有批量选择，忽略单个删除
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

  // 确认删除（支持单个和批量）
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      let result;
      let deletedIds: string[] = [];

      if (selectedAssetIds.size > 0) {
        // 批量删除
        deletedIds = Array.from(selectedAssetIds);
        result = await deleteAssets(deletedIds);
      } else if (assetToDelete) {
        // 单个删除
        deletedIds = [assetToDelete.id];
        result = await deleteAsset(assetToDelete.id);
      } else {
        return;
      }

      if (result.success) {
        const count = deletedIds.length;
        toast.success(`已删除 ${count} 个素材`);
        
        // 清除选中状态
        setSelectedAssetIds(new Set());
        
        // 刷新素材列表
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

  // 全选
  const handleSelectAll = () => {
    setSelectedAssetIds(new Set(assets.map((asset) => asset.id)));
  };

  // 取消全选
  const handleDeselectAll = () => {
    setSelectedAssetIds(new Set());
  };

  // 处理上传成功
  const handleUploadSuccess = () => {
    loadAssets();
  };

  // 打开 AI 创作编辑器 - 通过 AssetToolbar 回调
  const handleOpenAssetGeneration = () => {
    // AssetToolbar 会处理这个操作
  };

  if (!project) return null;

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="p-3 shrink-0">
        <AssetToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          availableTags={availableTags}
          onUpload={() => setUploadDialogOpen(true)}
          onOpenAssetGeneration={handleOpenAssetGeneration}
          selectedCount={selectedAssetIds.size}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onBatchDelete={handleBatchDelete}
        />
      </div>

      {/* 素材列表 */}
      <div className="flex-1 overflow-auto px-3 pb-3" style={{ containerType: 'inline-size' }}>
        <AssetList
          assets={assets}
          viewMode={viewMode}
          isLoading={isLoading}
          selectedAssetIds={selectedAssetIds}
          onDelete={handleDelete}
          onClick={handleAssetClick}
          onSelectChange={handleSelectChange}
          onUpload={() => setUploadDialogOpen(true)}
          jobs={jobs}
        />
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

      {/* 媒体查看器 - 支持图片和视频 */}
      {viewerAsset && (
        <MediaViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          asset={viewerAsset}
        />
      )}
    </div>
  );
}

