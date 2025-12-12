"use client";

import { ShotDetail } from "@/types/project";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Video, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ShotListPanelProps {
  shots: ShotDetail[];
  selectedShotIds: string[];
  onSelectionChange: (shotIds: string[]) => void;
  onShotsUpdate: () => void;
  loading?: boolean;
}

export function ShotListPanel({
  shots,
  selectedShotIds,
  onSelectionChange,
  loading,
}: ShotListPanelProps) {
  const handleSelectShot = (shotId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedShotIds, shotId]);
    } else {
      onSelectionChange(selectedShotIds.filter((id) => id !== shotId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(shots.map((s) => s.id));
    } else {
      onSelectionChange([]);
    }
  };

  const getStatusIcon = (shot: ShotDetail) => {
    if (shot.videoUrl) {
      return <CheckCircle2 className="w-4 h-4 text-[#10b981]" />;
    }
    if (shot.imageUrl) {
      return <ImageIcon className="w-4 h-4 text-[#f59e0b]" />;
    }
    return <XCircle className="w-4 h-4 text-gray-500" />;
  };

  const getStatusText = (shot: ShotDetail) => {
    if (shot.videoUrl) return "已生成";
    if (shot.imageUrl) return "待生成";
    return "无图片";
  };

  if (loading) {
    return (
      <div className="w-64 border-r border-border bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-background flex flex-col">
      {/* 头部 */}
      <div className="h-12 border-b border-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={shots.length > 0 && selectedShotIds.length === shots.length}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground font-['JetBrains_Mono']">
            分镜 ({shots.length})
          </span>
        </div>
      </div>

      {/* 分镜列表 */}
      <ScrollArea className="flex-1">
        {shots.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Video className="w-12 h-12 text-muted mb-3" />
            <p className="text-sm text-muted-foreground">暂无分镜</p>
            <p className="text-xs text-muted-foreground/60 mt-1">请先在分镜页面创建</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {shots.map((shot) => (
              <div
                key={shot.id}
                className={cn(
                  "group relative rounded-lg border transition-all cursor-pointer hover:border-primary overflow-hidden",
                  selectedShotIds.includes(shot.id)
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                )}
                onClick={() => handleSelectShot(shot.id, !selectedShotIds.includes(shot.id))}
              >
                {/* 缩略图 */}
                <div className="aspect-video bg-muted relative">
                  {shot.imageUrl || shot.videoUrl ? (
                    <img
                      src={shot.imageUrl || shot.videoUrl || ""}
                      alt={`Shot ${shot.order}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* 选择框 */}
                  <div className="absolute top-2 left-2">
                    <Checkbox
                      checked={selectedShotIds.includes(shot.id)}
                      onCheckedChange={(checked) => handleSelectShot(shot.id, checked as boolean)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-background/80 border-border"
                    />
                  </div>

                  {/* 状态图标 */}
                  <div className="absolute top-2 right-2">
                    {getStatusIcon(shot)}
                  </div>

                  {/* 视频标记 */}
                  {shot.videoUrl && (
                    <div className="absolute bottom-2 right-2">
                      <Video className="w-4 h-4 text-white drop-shadow-lg" />
                    </div>
                  )}
                </div>

                {/* 信息 */}
                <div className="p-2">
                  <div className="flex items-center justify-between mb-1">
                    <Badge
                      variant="outline"
                      className="text-xs font-['JetBrains_Mono']"
                    >
                      #{shot.order}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-['JetBrains_Mono']">
                      {((shot.duration || 3000) / 1000).toFixed(1)}s
                    </span>
                  </div>
                  {shot.visualDescription && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {shot.visualDescription}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <span
                      className={cn(
                        "text-xs font-['JetBrains_Mono']",
                        shot.videoUrl
                          ? "text-[#10b981]"
                          : shot.imageUrl
                          ? "text-[#f59e0b]"
                          : "text-muted-foreground"
                      )}
                    >
                      {getStatusText(shot)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
