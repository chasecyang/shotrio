"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Copy, Clock } from "lucide-react";
import type { GenerationHistoryItem } from "@/types/asset";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface GenerationHistoryPanelProps {
  history: GenerationHistoryItem[];
  onReusePrompt: (prompt: string, assetType: string, parameters: GenerationHistoryItem["parameters"]) => void;
  onClearHistory: () => void;
}

export function GenerationHistoryPanel({
  history,
  onReusePrompt,
  onClearHistory,
}: GenerationHistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>暂无创作历史</p>
        <p className="text-xs mt-1">创作的记录将显示在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">创作历史</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearHistory}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          清空
        </Button>
      </div>

      {/* 历史记录列表 */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {history.map((item) => (
            <Card key={item.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-3 space-y-2">
                {/* 头部信息 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.mode === "text-to-image" ? "文字创作" : "图片创作"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {item.assetType}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.timestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </div>

                {/* 提示词 */}
                <p className="text-sm line-clamp-2">{item.prompt}</p>

                {/* 参数 */}
                <div className="flex flex-wrap gap-1.5">
                  {item.parameters.aspectRatio && (
                    <Badge variant="outline" className="text-xs">
                      {item.parameters.aspectRatio}
                    </Badge>
                  )}
                  {item.parameters.resolution && (
                    <Badge variant="outline" className="text-xs">
                      {item.parameters.resolution}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {item.parameters.numImages || 1} 张
                  </Badge>
                </div>

                {/* 结果统计 */}
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-xs text-muted-foreground">
                    创作了 {item.resultAssetIds.length} 个素材
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReusePrompt(item.prompt, item.assetType, item.parameters)}
                    className="h-7 px-2 text-xs"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    复用
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

