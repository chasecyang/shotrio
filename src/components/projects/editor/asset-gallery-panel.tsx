"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useEditor } from "./editor-context";
import { AssetCard } from "./shared/asset-card";
import { queryAssets, deleteAsset, deleteAssets } from "@/lib/actions/asset";
import { AssetWithRuntimeStatus } from "@/types/asset";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Images, Film, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { retryJob } from "@/lib/actions/job";
import { cn } from "@/lib/utils";
import { AddAssetPanel } from "./shared/add-asset-panel";
import { TextAssetDialog } from "./shared/text-asset-dialog";
import { FloatingActionBar } from "./floating-action-bar";
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
import { AssetFilter, AssetFilterOptions } from "./shared/asset-filter";

interface AssetGalleryPanelProps {
  userId: string;
}

const DEFAULT_FILTER: AssetFilterOptions = {
  assetTypes: [],
  tags: [],
};

export function AssetGalleryPanel({ userId }: AssetGalleryPanelProps) {
  const { state, setMode } = useEditor();
  const { project } = state;

  const [allAssets, setAllAssets] = useState<AssetWithRuntimeStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddAssetPanel, setShowAddAssetPanel] = useState(false);
  const [textAssetDialogOpen, setTextAssetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AssetWithRuntimeStatus | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [filterOptions, setFilterOptions] = useState<AssetFilterOptions>(DEFAULT_FILTER);

  // 媒体查看器状态
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerAsset, setViewerAsset] = useState<AssetWithRuntimeStatus | null>(null);
  
  // 文本资产编辑状态
  const [editingTextAsset, setEditingTextAsset] = useState<AssetWithRuntimeStatus | null>(null);

  // 加载素材
  const loadAssets = useCallback(async () => {
    if (!project?.id) return;

    setIsLoading(true);
    try {
      const result = await queryAssets({
        projectId: project.id,
        limit: 200,
        search: filterOptions.search,
        tagFilters: filterOptions.tags.length > 0 ? filterOptions.tags : undefined,
      });
      setAllAssets(result.assets);
    } catch (error) {
      console.error("加载素材失败:", error);
      toast.error("加载素材失败");
    } finally {
      setIsLoading(false);
    }
  }, [project?.id, filterOptions.search, filterOptions.tags]);

  // 初始加载
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // 监听素材创建事件（用于手动上传素材或作为兜底刷新机制）
  // 注意：Agent生成素材的刷新由 useTaskRefresh 统一处理
  useEffect(() => {
    const handleAssetCreated = () => {
      loadAssets();
    };

    window.addEventListener("asset-created", handleAssetCreated);
    return () => {
      window.removeEventListener("asset-created", handleAssetCreated);
    };
  }, [loadAssets]);

  // 客户端筛选逻辑（用于素材类型筛选）
  const filteredAssets = useMemo(() => {
    let result = [...allAssets];

    // 素材类型筛选（image/video）
    if (filterOptions.assetTypes.length > 0) {
      result = result.filter(asset => 
        filterOptions.assetTypes.includes(asset.assetType)
      );
    }

    return result;
  }, [allAssets, filterOptions.assetTypes]);

  // 重置筛选
  const handleResetFilter = () => {
    setFilterOptions(DEFAULT_FILTER);
  };

  // 处理素材点击 - 根据类型打开不同的查看器
  const handleAssetClick = (asset: AssetWithRuntimeStatus) => {
    if (asset.assetType === "text") {
      // 文本资产打开编辑对话框
      setEditingTextAsset(asset);
      setTextAssetDialogOpen(true);
    } else {
      // 图片/视频打开媒体查看器
      setViewerAsset(asset);
      setViewerOpen(true);
    }
  };

  // 处理删除
  const handleDelete = (asset: AssetWithRuntimeStatus) => {
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

  // 全选
  const handleSelectAll = () => {
    setSelectedAssetIds(new Set(filteredAssets.map((asset) => asset.id)));
  };

  // 取消全选
  const handleDeselectAll = () => {
    setSelectedAssetIds(new Set());
  };

  // 处理上传成功
  const handleUploadSuccess = () => {
    loadAssets();
  };

  // 处理重试
  const handleRetry = async (jobId: string) => {
    try {
      const result = await retryJob(jobId);
      if (result.success) {
        toast.success("已重新提交任务");
        await loadAssets();
      } else {
        toast.error(result.error || "重试失败");
      }
    } catch (error) {
      console.error("重试失败:", error);
      toast.error("重试失败");
    }
  };

  if (!project) return null;

  // 如果显示添加素材面板，则渲染面板而不是素材列表
  if (showAddAssetPanel) {
    return (
      <AddAssetPanel
        projectId={project.id}
        onBack={() => setShowAddAssetPanel(false)}
        onSuccess={() => {
          loadAssets();
          setShowAddAssetPanel(false);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* 模式切换器 */}
            <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-1">
              <button
                onClick={() => setMode("asset-management")}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  "hover:bg-background/60",
                  "bg-background text-foreground shadow-sm"
                )}
              >
                <Images className="h-4 w-4" />
                <span>素材</span>
              </button>
              <button
                onClick={() => setMode("editing")}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  "hover:bg-background/60",
                  "text-muted-foreground"
                )}
              >
                <Film className="h-4 w-4" />
                <span>剪辑</span>
              </button>
            </div>
            <span className="text-xs text-muted-foreground">
              ({filteredAssets.length}{allAssets.length !== filteredAssets.length && ` / ${allAssets.length}`})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowAddAssetPanel(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              添加素材
            </Button>
          </div>
        </div>
        
        {/* 筛选栏 */}
        <div className="px-4 pb-3">
          <AssetFilter 
            value={filterOptions}
            onChange={setFilterOptions}
            onReset={handleResetFilter}
            allAssets={allAssets}
          />
        </div>
      </div>

      {/* 素材网格 */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {isLoading ? (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-video w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                <Images className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-2">
                {allAssets.length === 0 ? "暂无素材" : "没有符合条件的素材"}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                {allAssets.length === 0 
                  ? "开始创作第一个素材，可以使用 AI 生成或上传本地文件"
                  : "尝试调整筛选条件查看更多素材"
                }
              </p>
              {allAssets.length === 0 && (
                <Button onClick={() => setShowAddAssetPanel(true)} size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  添加素材
                </Button>
              )}
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              }}
            >
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
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

      {/* 文本资产编辑对话框 */}
      <TextAssetDialog
        open={textAssetDialogOpen}
        onOpenChange={(open) => {
          setTextAssetDialogOpen(open);
          if (!open) {
            setEditingTextAsset(null);
          }
        }}
        projectId={project.id}
        asset={editingTextAsset || undefined}
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
          onRetry={handleRetry}
        />
      )}

      {/* 悬浮操作栏 */}
      {selectedAssetIds.size > 0 && (
        <FloatingActionBar
          selectedCount={selectedAssetIds.size}
          totalCount={filteredAssets.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onDelete={handleBatchDelete}
        />
      )}
    </div>
  );
}

