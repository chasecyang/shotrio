"use client";

import { useState, useEffect, useMemo } from "react";
import { useEditor } from "./editor-context";
import { AssetCard } from "./shared/asset-card";
import { AssetGroup } from "./shared/asset-group";
import { deleteAsset, deleteAssets } from "@/lib/actions/asset";
import { AssetWithFullData } from "@/types/asset";
import { toast } from "sonner";
import { Images, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { retryJob } from "@/lib/actions/job";
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
import { AssetDetailView } from "./shared/asset-detail-view";
import {
  AssetFilter,
  AssetFilterOptions,
  SortOption,
} from "./shared/asset-filter";
import { UNCATEGORIZED_GROUP } from "@/lib/constants/asset-tags";

interface AssetGalleryPanelProps {
  userId: string;
}

const DEFAULT_FILTER: AssetFilterOptions = {
  assetTypes: [],
  sort: "createdAt",
};

// 统计所有标签出现次数
function countTagOccurrences(
  assets: AssetWithFullData[]
): Map<string, number> {
  const tagCounts = new Map<string, number>();

  assets.forEach((asset) => {
    const tags = asset.tags?.map((t) => t.tagValue) || [];
    tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return tagCounts;
}

// 按标签分组素材
function groupAssetsByTag(
  assets: AssetWithFullData[],
  tagCounts: Map<string, number>
): Map<string, AssetWithFullData[]> {
  const groups = new Map<string, AssetWithFullData[]>();

  assets.forEach((asset) => {
    const tags = asset.tags?.map((t) => t.tagValue) || [];

    if (tags.length === 0) {
      const group = groups.get(UNCATEGORIZED_GROUP) || [];
      group.push(asset);
      groups.set(UNCATEGORIZED_GROUP, group);
    } else {
      // 按标签出现次数排序，取出现最多的标签作为主标签
      const sortedTags = [...tags].sort((a, b) => {
        const countA = tagCounts.get(a) || 0;
        const countB = tagCounts.get(b) || 0;
        return countB - countA;
      });
      const primaryTag = sortedTags[0];

      const group = groups.get(primaryTag) || [];
      group.push(asset);
      groups.set(primaryTag, group);
    }
  });

  return groups;
}

// 对分组按素材数量排序
function sortGroups(
  groups: Map<string, AssetWithFullData[]>
): [string, AssetWithFullData[]][] {
  return Array.from(groups.entries()).sort(
    ([tagA, assetsA], [tagB, assetsB]) => {
      if (tagA === UNCATEGORIZED_GROUP) return 1;
      if (tagB === UNCATEGORIZED_GROUP) return -1;
      return assetsB.length - assetsA.length;
    }
  );
}

// 排序素材
function sortAssets(
  assets: AssetWithFullData[],
  sortOption: SortOption
): AssetWithFullData[] {
  const sorted = [...assets];

  switch (sortOption) {
    case "createdAt":
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
      break;
    case "usageCount":
      sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      break;
  }

  return sorted;
}

export function AssetGalleryPanel({ userId }: AssetGalleryPanelProps) {
  const { state, loadAssets } = useEditor();
  const { project, assets: allAssets, assetsLoading, assetsLoaded } = state;

  const [textAssetDialogOpen, setTextAssetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AssetWithFullData | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set()
  );
  const [filterOptions, setFilterOptions] =
    useState<AssetFilterOptions>(DEFAULT_FILTER);

  // 详情视图状态
  const [selectedAsset, setSelectedAsset] = useState<AssetWithFullData | null>(
    null
  );

  // 文本资产编辑状态
  const [editingTextAsset, setEditingTextAsset] =
    useState<AssetWithFullData | null>(null);

  // 初始加载或静默刷新
  useEffect(() => {
    if (!project?.id) return;
    loadAssets({ search: filterOptions.search });
  }, [project?.id, loadAssets, filterOptions.search]);

  // 监听素材创建事件
  useEffect(() => {
    const handleAssetCreated = () => {
      loadAssets({ search: filterOptions.search });
    };

    window.addEventListener("asset-created", handleAssetCreated);
    return () => {
      window.removeEventListener("asset-created", handleAssetCreated);
    };
  }, [loadAssets, filterOptions.search]);

  // 客户端筛选和排序逻辑
  const filteredAssets = useMemo(() => {
    let result = [...allAssets];

    // 素材类型筛选
    if (filterOptions.assetTypes.length > 0) {
      result = result.filter((asset) =>
        filterOptions.assetTypes.includes(asset.assetType)
      );
    }

    // 排序
    result = sortAssets(result, filterOptions.sort);

    return result;
  }, [allAssets, filterOptions.assetTypes, filterOptions.sort]);

  // 分组后的素材
  const groupedAssets = useMemo(() => {
    const tagCounts = countTagOccurrences(filteredAssets);
    const groups = groupAssetsByTag(filteredAssets, tagCounts);
    return sortGroups(groups);
  }, [filteredAssets]);

  // 是否显示分组视图
  const showGroupedView = filteredAssets.length > 0;

  // 处理素材点击
  const handleAssetClick = (asset: AssetWithFullData) => {
    if (asset.assetType === "text") {
      setEditingTextAsset(asset);
      setTextAssetDialogOpen(true);
    } else {
      setSelectedAsset(asset);
    }
  };

  // 返回网格视图
  const handleBackToGrid = () => {
    setSelectedAsset(null);
  };

  // 素材更新后刷新
  const handleAssetUpdated = () => {
    loadAssets({ search: filterOptions.search });
  };

  // 当 allAssets 更新时，同步更新 selectedAsset
  useEffect(() => {
    if (selectedAsset) {
      const updated = allAssets.find((a) => a.id === selectedAsset.id);
      if (updated && updated !== selectedAsset) {
        setSelectedAsset(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAssets]);

  // 处理删除
  const handleDelete = (asset: AssetWithFullData) => {
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
        await loadAssets({ search: filterOptions.search });
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
    loadAssets({ search: filterOptions.search });
  };

  // 处理重试
  const handleRetry = async (jobId: string) => {
    try {
      const result = await retryJob(jobId);
      if (result.success) {
        toast.success("已重新提交任务");
        await loadAssets({ search: filterOptions.search });
      } else {
        toast.error(result.error || "重试失败");
      }
    } catch (error) {
      console.error("重试失败:", error);
      toast.error("重试失败");
    }
  };

  if (!project) return null;

  // 如果有选中的素材，显示详情视图
  if (selectedAsset) {
    return (
      <div className="h-full flex flex-col bg-background">
        <AssetDetailView
          asset={selectedAsset}
          onBack={handleBackToGrid}
          onRetry={handleRetry}
          onAssetUpdated={handleAssetUpdated}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <AssetFilter value={filterOptions} onChange={setFilterOptions} />
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground shrink-0">
              {filteredAssets.length}
              {allAssets.length !== filteredAssets.length &&
                ` / ${allAssets.length}`}{" "}
              个素材
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() =>
                loadAssets({
                  search: filterOptions.search,
                  showLoading: true,
                })
              }
              disabled={assetsLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${assetsLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* 素材区域 */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {!assetsLoaded && assetsLoading ? (
            // 加载骨架屏
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
            // 空状态
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                <Images className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-2">
                {allAssets.length === 0 ? "暂无素材" : "没有符合条件的素材"}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                {allAssets.length === 0
                  ? "暂无素材"
                  : "尝试调整筛选条件查看更多素材"}
              </p>
            </div>
          ) : showGroupedView ? (
            // 分组视图
            <div className="space-y-2">
              {groupedAssets.map(([groupName, assets]) => (
                <AssetGroup
                  key={groupName}
                  title={groupName}
                  count={assets.length}
                  assets={assets}
                  selectedAssetIds={selectedAssetIds}
                  onAssetClick={handleAssetClick}
                  onAssetDelete={handleDelete}
                  onSelectChange={handleSelectChange}
                />
              ))}
            </div>
          ) : (
            // 普通网格视图
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
