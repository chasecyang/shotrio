"use client";

import { AssetWithTags } from "@/types/asset";
import { AssetCard } from "./asset-card";
import { Images, Upload, User, MapPin, Package, Sparkles, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditor } from "../editor-context";
import { useTranslations } from "next-intl";

interface AssetListProps {
  assets: AssetWithTags[];
  viewMode: "grid" | "list";
  isLoading?: boolean;
  selectedAssetId?: string | null;
  selectedAssetIds?: Set<string>;
  onDelete: (asset: AssetWithTags) => void;
  onClick: (asset: AssetWithTags) => void;
  onSelectChange?: (assetId: string, selected: boolean) => void;
  onUpload: () => void;
}

// 空状态卡片项
function EmptyStateItem({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card/50">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium mb-0.5">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function AssetList({
  assets,
  viewMode,
  isLoading = false,
  selectedAssetId,
  selectedAssetIds = new Set(),
  onDelete,
  onClick,
  onSelectChange,
  onUpload,
}: AssetListProps) {
  const { state, selectResource } = useEditor();
  const t = useTranslations("projects.assets");
  const { project } = state;

  // 打开 AI 创作编辑器
  const handleOpenAssetGeneration = () => {
    selectResource({
      type: "asset-generation",
      id: project?.id || "",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">加载创作素材中...</p>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="w-full max-w-md space-y-4">
          {/* 标题 */}
          <div className="text-center mb-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 mx-auto">
              <Images className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1.5">{t("empty.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>

          {/* 素材类型说明 */}
          <div className="space-y-2">
            <EmptyStateItem
              icon={User}
              title={t("empty.categories.character").split(" - ")[0]}
              description={t("empty.categories.character").split(" - ")[1]}
            />
            <EmptyStateItem
              icon={MapPin}
              title={t("empty.categories.scene").split(" - ")[0]}
              description={t("empty.categories.scene").split(" - ")[1]}
            />
            <EmptyStateItem
              icon={Package}
              title={t("empty.categories.prop").split(" - ")[0]}
              description={t("empty.categories.prop").split(" - ")[1]}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleOpenAssetGeneration} className="flex-1" size="sm">
              <Sparkles className="w-4 h-4 mr-1.5" />
              {t("empty.actionAI")}
            </Button>
            <Button onClick={onUpload} variant="outline" className="flex-1" size="sm">
              <Upload className="w-4 h-4 mr-1.5" />
              {t("empty.action")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        viewMode === "grid"
          ? "grid gap-3"
          : "flex flex-col gap-2"
      )}
      style={{
        gridTemplateColumns: viewMode === "grid" 
          ? "repeat(auto-fill, minmax(180px, 1fr))" 
          : undefined
      }}
    >
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          viewMode={viewMode}
          isSelected={selectedAssetId === asset.id}
          isBatchSelected={selectedAssetIds.has(asset.id)}
          onDelete={onDelete}
          onClick={onClick}
          onSelectChange={onSelectChange}
        />
      ))}
    </div>
  );
}

