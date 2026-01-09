"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useEditor } from "./editor-context";
import { AssetCard } from "./shared/asset-card";
import { AssetGroup } from "./shared/asset-group";
import { deleteAsset, deleteAssets } from "@/lib/actions/asset";
import { regenerateAssetImage } from "@/lib/actions/asset/generate-asset";
import { regenerateVideoAsset } from "@/lib/actions/asset/crud";
import { AssetWithFullData, ImageResolution, AssetTypeEnum } from "@/types/asset";
import type { AspectRatio } from "@/lib/services/image.service";
import { toast } from "sonner";
import { Images, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { retryJob } from "@/lib/actions/job";
import { TextAssetDialog } from "./shared/text-asset-dialog";
import { MediaUploadDialog } from "./shared/media-upload-dialog";
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
  AssetFilterOptions,
  SortOption,
  AssetTypeTabs,
  AssetSearchSort,
} from "./shared/asset-filter";
import { UNCATEGORIZED_GROUP } from "@/lib/constants/asset-tags";
import { useTranslations } from "next-intl";

// localStorage key
const getAssetTypeFilterKey = (projectId: string) => `editor:project:${projectId}:assetTypeFilter`;
const VALID_ASSET_TYPES: AssetTypeEnum[] = ["image", "video", "text", "audio"];

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

export function AssetGalleryPanel() {
  const {
    state,
    loadAssets,
    setEditingAsset,
  } = useEditor();
  const { project, assets: allAssets, assetsLoading, assetsLoaded } = state;
  const t = useTranslations("editor.assetGallery");
  const tCommon = useTranslations("common");

  const [textAssetDialogOpen, setTextAssetDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AssetWithFullData | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [assetToRegenerate, setAssetToRegenerate] = useState<AssetWithFullData | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set()
  );
  const [filterOptions, setFilterOptions] =
    useState<AssetFilterOptions>(DEFAULT_FILTER);

  // 从 localStorage 恢复素材类型筛选
  const filterRestoredRef = useRef(false);
  useEffect(() => {
    if (!project?.id || filterRestoredRef.current) return;
    filterRestoredRef.current = true;
    try {
      const saved = localStorage.getItem(getAssetTypeFilterKey(project.id));
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const validTypes = parsed.filter((t): t is AssetTypeEnum =>
          VALID_ASSET_TYPES.includes(t as AssetTypeEnum)
        );
        if (validTypes.length > 0) {
          setFilterOptions(prev => ({ ...prev, assetTypes: validTypes }));
        }
      }
    } catch {}
  }, [project?.id]);

  // 保存素材类型筛选到 localStorage
  useEffect(() => {
    if (!project?.id || !filterRestoredRef.current) return;
    try {
      localStorage.setItem(getAssetTypeFilterKey(project.id), JSON.stringify(filterOptions.assetTypes));
    } catch {}
  }, [project?.id, filterOptions.assetTypes]);

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
        toast.success(t("deleteSuccess", { count }));
        setSelectedAssetIds(new Set());
        await loadAssets({ search: filterOptions.search });
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

  // 处理上传成功
  const handleUploadSuccess = () => {
    loadAssets({ search: filterOptions.search });
  };

  // 处理重试
  const handleRetry = async (jobId: string) => {
    try {
      const result = await retryJob(jobId);
      if (result.success) {
        toast.success(t("retrySubmitted"));
        await loadAssets({ search: filterOptions.search });
      } else {
        toast.error(result.error || t("retryFailed"));
      }
    } catch (error) {
      console.error("Retry failed:", error);
      toast.error(t("retryFailed"));
    }
  };

  // 处理重新生成 - 打开确认对话框
  const handleRegenerate = (asset: AssetWithFullData) => {
    setAssetToRegenerate(asset);
    setRegenerateDialogOpen(true);
  };

  // 确认重新生成
  const handleConfirmRegenerate = async () => {
    if (!assetToRegenerate) return;

    setIsRegenerating(true);
    const toastId = `regenerate-${assetToRegenerate.id}`;
    toast.loading(t("regenerating"), { id: toastId });
    try {
      let result;
      if (assetToRegenerate.assetType === "video") {
        result = await regenerateVideoAsset(assetToRegenerate.id);
      } else {
        result = await regenerateAssetImage(assetToRegenerate.id);
      }

      if (result.success) {
        toast.success(t("regenerating"), { id: toastId });
        await loadAssets({ search: filterOptions.search });
      } else {
        toast.error(result.error || t("regenerateFailed"), { id: toastId });
      }
    } catch (error) {
      console.error("Regenerate failed:", error);
      toast.error(t("regenerateFailed"), { id: toastId });
    } finally {
      setIsRegenerating(false);
      setRegenerateDialogOpen(false);
      setAssetToRegenerate(null);
    }
  };

  // 处理编辑 - 跳转到生成面板并预填充参数
  const handleEdit = (asset: AssetWithFullData) => {
    // 解析 generationConfig
    let config: { aspectRatio?: AspectRatio; resolution?: ImageResolution } = {};
    if (asset.generationConfig) {
      try {
        config = JSON.parse(asset.generationConfig);
      } catch {
        // 使用默认值
      }
    }

    // 设置编辑状态（这会自动设置 sourceAssetIds 和切换模式）
    setEditingAsset(asset, {
      prompt: asset.prompt || "",
      aspectRatio: config.aspectRatio || "16:9",
      resolution: config.resolution || "2K",
    });

    // 关闭详情视图（如果打开的话）
    setSelectedAsset(null);
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
        {/* 第二行：搜索框 + 排序 + 素材计数 */}
        <div className="flex items-center gap-2">
          <AssetSearchSort
            search={filterOptions.search}
            sort={filterOptions.sort}
            onSearchChange={(search) =>
              setFilterOptions({ ...filterOptions, search })
            }
            onSortChange={(sort) =>
              setFilterOptions({ ...filterOptions, sort })
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
                {allAssets.length === 0 ? t("noAssets") : t("noMatchingAssets")}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                {allAssets.length === 0
                  ? t("noAssets")
                  : t("tryAdjustFilter")}
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
                  onRegenerate={handleRegenerate}
                  onEdit={handleEdit}
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
                  onRegenerate={handleRegenerate}
                  onEdit={handleEdit}
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
              {selectedAssetIds.size > 0
                ? t("confirmDeleteBatch", { count: selectedAssetIds.size })
                : t("confirmDeleteSingle", { name: assetToDelete?.name ?? "" })}
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

      {/* 重新生成确认对话框 */}
      <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmRegenerate")}</AlertDialogTitle>
            <AlertDialogDescription>
              {assetToRegenerate?.assetType === "video"
                ? t("confirmRegenerateVideo", {
                    name: assetToRegenerate?.name ?? "",
                    credits: Math.ceil((assetToRegenerate?.duration || 5000) / 1000) * 6
                  })
                : t("confirmRegenerateImage", {
                    name: assetToRegenerate?.name ?? "",
                    credits: 6
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerating}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? t("regenerating") : tCommon("confirm")}
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
