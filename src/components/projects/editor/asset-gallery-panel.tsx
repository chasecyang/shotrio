"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useEditor, type LoadAssetsOptions } from "./editor-context";
import { AssetGroup } from "./shared/asset-group";
import { deleteAsset, deleteAssets, updateAssetSelectionStatus, batchUpdateSelectionStatus } from "@/lib/actions/asset";
import { AssetWithFullData, AssetTypeEnum, AssetSelectionStatus } from "@/types/asset";
import { toast } from "sonner";
import { Images, RefreshCw, Upload, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { retryJob } from "@/lib/actions/job";
import { TextAssetDetailView } from "./shared/text-asset-detail-view";
import { MediaUploadDialog } from "./shared/media-upload-dialog";
import { FloatingActionBar } from "./floating-action-bar";
import {
  batchDownloadAssets,
  DownloadProgress,
} from "@/lib/utils/batch-download";
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
  AssetFilterOptions,
  AssetTypeTabs,
  AssetSearch,
} from "./shared/asset-filter";
import { AssetSelectionTabs } from "./shared/asset-selection-filter";
import { UNCATEGORIZED_GROUP } from "@/lib/constants/asset-tags";
import { useTranslations } from "next-intl";

// localStorage keys
const getAssetTypeFilterKey = (projectId: string) => `editor:project:${projectId}:assetTypeFilter`;
const getSelectionStatusFilterKey = (projectId: string) => `editor:project:${projectId}:selectionStatusFilter`;
const VALID_ASSET_TYPES: AssetTypeEnum[] = ["image", "video", "text", "audio"];

const DEFAULT_FILTER: AssetFilterOptions = {
  assetTypes: [],
  selectionStatus: [],
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

export function AssetGalleryPanel() {
  const {
    state,
    loadAssets,
    referenceAssetInChat,
  } = useEditor();
  const { project, assets: allAssets, assetsLoading, assetsLoaded } = state;
  const t = useTranslations("editor.assetGallery");
  const tCommon = useTranslations("common");

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AssetWithFullData | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set()
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<
    DownloadProgress | undefined
  >(undefined);
  const [initialLoadStarted, setInitialLoadStarted] = useState(false);
  const getSavedAssetTypes = (projectId?: string) => {
    if (!projectId || typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(getAssetTypeFilterKey(projectId));
      if (!saved) return [];
      const parsed = JSON.parse(saved) as string[];
      return parsed.filter((t): t is AssetTypeEnum =>
        VALID_ASSET_TYPES.includes(t as AssetTypeEnum)
      );
    } catch {
      return [];
    }
  };

  const getSavedSelectionStatus = (projectId: string | undefined): AssetSelectionStatus[] => {
    if (!projectId) return [];
    try {
      const saved = localStorage.getItem(getSelectionStatusFilterKey(projectId));
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is AssetSelectionStatus =>
          s === "unrated" || s === "selected" || s === "rejected"
        );
      }
      return [];
    } catch {
      return [];
    }
  };

  const [filterOptions, setFilterOptions] = useState<AssetFilterOptions>(() => ({
    ...DEFAULT_FILTER,
    assetTypes: getSavedAssetTypes(project?.id),
    selectionStatus: getSavedSelectionStatus(project?.id),
  }));

  // 切换项目时恢复素材类型筛选和筛选状态
  const lastProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!project?.id) return;
    if (lastProjectIdRef.current === project.id) return;
    lastProjectIdRef.current = project.id;
    setFilterOptions(prev => ({
      ...prev,
      assetTypes: getSavedAssetTypes(project.id),
      selectionStatus: getSavedSelectionStatus(project.id),
    }));
  }, [project?.id]);

  // 保存素材类型筛选到 localStorage
  useEffect(() => {
    if (!project?.id) return;
    try {
      localStorage.setItem(getAssetTypeFilterKey(project.id), JSON.stringify(filterOptions.assetTypes));
    } catch {}
  }, [project?.id, filterOptions.assetTypes]);

  // 保存筛选状态到 localStorage
  useEffect(() => {
    if (!project?.id) return;
    try {
      localStorage.setItem(getSelectionStatusFilterKey(project.id), JSON.stringify(filterOptions.selectionStatus));
    } catch {}
  }, [project?.id, filterOptions.selectionStatus]);

  // 详情视图状态
  const [selectedAsset, setSelectedAsset] = useState<AssetWithFullData | null>(
    null
  );

  // 初始加载或静默刷新
  const refreshAssets = useCallback(
    (options?: LoadAssetsOptions) =>
      loadAssets({
        search: filterOptions.search,
        ...options,
      }),
    [loadAssets, filterOptions.search]
  );

  useEffect(() => {
    if (!project?.id) return;
    setInitialLoadStarted(true);
    refreshAssets();
  }, [project?.id, refreshAssets]);

  // 监听素材创建事件
  useEffect(() => {
    const handleAssetCreated = () => {
      refreshAssets();
    };

    window.addEventListener("asset-created", handleAssetCreated);
    return () => {
      window.removeEventListener("asset-created", handleAssetCreated);
    };
  }, [refreshAssets]);

  // 客户端筛选逻辑
  const filteredAssets = useMemo(() => {
    let filtered = allAssets;

    // Filter by asset type
    if (filterOptions.assetTypes.length > 0) {
      filtered = filtered.filter((asset) =>
        filterOptions.assetTypes.includes(asset.assetType)
      );
    }

    // Filter by selection status
    if (filterOptions.selectionStatus && filterOptions.selectionStatus.length > 0) {
      filtered = filtered.filter((asset) =>
        filterOptions.selectionStatus!.includes(asset.selectionStatus)
      );
    }

    return filtered;
  }, [allAssets, filterOptions.assetTypes, filterOptions.selectionStatus]);

  // 分组后的素材
  const groupedAssets = useMemo(() => {
    const tagCounts = countTagOccurrences(filteredAssets);
    const groups = groupAssetsByTag(filteredAssets, tagCounts);
    return sortGroups(groups);
  }, [filteredAssets]);

  // 处理素材点击
  const handleAssetClick = (asset: AssetWithFullData) => {
    setSelectedAsset(asset);
  };

  // 返回网格视图
  const handleBackToGrid = () => {
    setSelectedAsset(null);
  };

  // 素材更新后刷新
  const handleAssetUpdated = refreshAssets;

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

  // 处理删除 - 点击素材卡片上的删除按钮，始终只删除那一张素材
  const handleDelete = (asset: AssetWithFullData) => {
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

      // assetToDelete 优先级更高（用户点击了未选中素材的删除按钮）
      if (assetToDelete) {
        deletedIds = [assetToDelete.id];
        result = await deleteAsset(assetToDelete.id);
      } else if (selectedAssetIds.size > 0) {
        // 批量删除（用户点击了选中素材的删除按钮或浮动栏的批量删除按钮）
        deletedIds = Array.from(selectedAssetIds);
        result = await deleteAssets(deletedIds);
      } else {
        return;
      }

      if (result.success) {
        const count = deletedIds.length;
        toast.success(t("deleteSuccess", { count }));
        setSelectedAssetIds(new Set());
        await refreshAssets();
      } else {
        toast.error(result.error || t("deleteFailed"));
      }
    } catch (error) {
      console.error("Delete asset failed:", error);
      toast.error(t("deleteFailed"));
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

  // 批量下载
  const handleBatchDownload = async () => {
    if (selectedAssetIds.size === 0) return;

    const selectedAssets = filteredAssets.filter((asset) =>
      selectedAssetIds.has(asset.id)
    );

    if (selectedAssets.length === 0) return;

    setIsDownloading(true);
    setDownloadProgress(undefined);

    try {
      const result = await batchDownloadAssets(
        selectedAssets,
        (progress: DownloadProgress) => {
          setDownloadProgress(progress);
        }
      );

      if (result.success) {
        if (result.failedCount > 0) {
          toast.warning(
            t("downloadPartialSuccess", {
              success: result.downloadedCount,
              failed: result.failedCount,
            })
          );
        } else {
          toast.success(t("downloadSuccess", { count: result.downloadedCount }));
        }
      } else {
        toast.error(t("downloadFailed"));
      }
    } catch (error) {
      console.error("Batch download failed:", error);
      toast.error(t("downloadFailed"));
    } finally {
      setIsDownloading(false);
      setDownloadProgress(undefined);
    }
  };

  // 处理上传成功
  const handleUploadSuccess = () => {
    refreshAssets();
  };

  // 处理重试
  const handleRetry = async (jobId: string) => {
    try {
      const result = await retryJob(jobId);
      if (result.success) {
        toast.success(t("retrySubmitted"));
        await refreshAssets();
      } else {
        toast.error(result.error || t("retryFailed"));
      }
    } catch (error) {
      console.error("Retry failed:", error);
      toast.error(t("retryFailed"));
    }
  };

  // 处理引用素材到对话
  const handleReference = (asset: AssetWithFullData) => {
    const assetTypeText = asset.assetType === 'image' ? '图片' :
                          asset.assetType === 'video' ? '视频' :
                          asset.assetType === 'audio' ? '音频' : '素材';
    const presetText = `请基于 {{reference}} 生成新的${assetTypeText}素材，`;
    // 通过 editor context 触发引用
    referenceAssetInChat?.(asset, presetText);
    toast.success(`已引用「${asset.name}」到对话框`);
  };

  const handleSelectionStatusChange = async (asset: AssetWithFullData, status: AssetSelectionStatus) => {
    const result = await updateAssetSelectionStatus(asset.id, status);
    if (result.success) {
      // Refresh assets to show updated status
      refreshAssets();
      const statusText = status === "selected" ? "精选" : status === "rejected" ? "废弃" : "未筛选";
      toast.success(`已标记为${statusText}`);
    } else {
      toast.error(result.error || "更新失败");
    }
  };

  const handleBatchMarkSelected = async () => {
    const assetIds = Array.from(selectedAssetIds);
    const result = await batchUpdateSelectionStatus(assetIds, "selected");
    if (result.success) {
      refreshAssets();
      toast.success(`已将 ${result.updatedCount} 个素材标记为精选`);
      setSelectedAssetIds(new Set());
    } else {
      toast.error(result.error || "批量更新失败");
    }
  };

  const handleBatchMarkRejected = async () => {
    const assetIds = Array.from(selectedAssetIds);
    const result = await batchUpdateSelectionStatus(assetIds, "rejected");
    if (result.success) {
      refreshAssets();
      toast.success(`已将 ${result.updatedCount} 个素材标记为废弃`);
      setSelectedAssetIds(new Set());
    } else {
      toast.error(result.error || "批量更新失败");
    }
  };

  const handleBatchMarkUnrated = async () => {
    const assetIds = Array.from(selectedAssetIds);
    const result = await batchUpdateSelectionStatus(assetIds, "unrated");
    if (result.success) {
      refreshAssets();
      toast.success(`已将 ${result.updatedCount} 个素材标记为未筛选`);
      setSelectedAssetIds(new Set());
    } else {
      toast.error(result.error || "批量更新失败");
    }
  };

  if (!project) return null;

  // 如果有选中的素材，显示详情视图
  if (selectedAsset) {
    // 文本素材使用专门的详情视图
    if (selectedAsset.assetType === "text") {
      return (
        <div className="h-full flex flex-col overflow-hidden">
          <TextAssetDetailView
            asset={selectedAsset}
            onBack={handleBackToGrid}
            onAssetUpdated={handleAssetUpdated}
          />
        </div>
      );
    }
    // 其他素材使用通用详情视图
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <AssetDetailView
          asset={selectedAsset}
          onBack={handleBackToGrid}
          onRetry={handleRetry}
          onReference={handleReference}
          onAssetUpdated={handleAssetUpdated}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b space-y-2">
        {/* 第一行：类型Tab + 刷新按钮 */}
        <div className="flex items-center justify-between gap-3">
          <AssetTypeTabs
            value={filterOptions.assetTypes}
            onChange={(types) =>
              setFilterOptions({ ...filterOptions, assetTypes: types })
            }
          />
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="text-xs">{t("upload")}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() =>
                refreshAssets({ showLoading: true })
              }
              disabled={assetsLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${assetsLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
        {/* 第二行：筛选状态Tab */}
        <div className="flex items-center gap-2">
          <AssetSelectionTabs
            value={filterOptions.selectionStatus || []}
            onChange={(statuses) =>
              setFilterOptions({ ...filterOptions, selectionStatus: statuses })
            }
          />
        </div>
        {/* 第三行：搜索框 + 素材计数 */}
        <div className="flex items-center gap-2">
          <AssetSearch
            search={filterOptions.search}
            onSearchChange={(search) =>
              setFilterOptions({ ...filterOptions, search })
            }
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {t("assetsCount", { count: filteredAssets.length })}
            {allAssets.length !== filteredAssets.length &&
              ` / ${allAssets.length}`}
          </span>
        </div>
      </div>

      {/* 素材区域 */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {!assetsLoaded && (assetsLoading || !initialLoadStarted) ? (
            // 加载骨架屏
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(192px, 1fr))",
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
              {allAssets.length === 0 ? (
                // 完全没有素材 - 简约引导
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Bot className="w-6 h-6 text-primary/70" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground/80 mb-1">
                    {t("emptyStateTitle")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t("emptyStateDescription")}
                  </p>
                </div>
              ) : (
                // 筛选结果为空 - 简单提示
                <>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                    <Images className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">
                    {t("noMatchingAssets")}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    {t("tryAdjustFilter")}
                  </p>
                </>
              )}
            </div>
          ) : (
            // 分组视图（当前逻辑下始终启用）
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
                  onReference={handleReference}
                  onSelectionStatusChange={handleSelectionStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 多媒体上传对话框 */}
      <MediaUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        projectId={project.id}
        userId={project.userId}
        onSuccess={handleUploadSuccess}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {assetToDelete
                ? t("confirmDeleteSingle", { name: assetToDelete.name })
                : t("confirmDeleteBatch", { count: selectedAssetIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("deleting") : tCommon("delete")}
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
          onDownload={handleBatchDownload}
          onMarkSelected={handleBatchMarkSelected}
          onMarkRejected={handleBatchMarkRejected}
          onMarkUnrated={handleBatchMarkUnrated}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
        />
      )}
    </div>
  );
}
