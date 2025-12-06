"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateShots, getEpisodeShots } from "@/lib/actions/project-actions";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus } from "lucide-react";
import { ShotCard } from "./shot-card";

interface Shot {
  id: string;
  order: number;
  shotSize: string;
  visualDescription: string | null;
  dialogue: string | null;
  duration: number | null;
}

interface ShotsSectionProps {
  episodeId: string;
  projectId: string;
  shots: Shot[];
}

export function ShotsSection({ episodeId, projectId, shots: initialShots }: ShotsSectionProps) {
  const [generating, setGenerating] = useState(false);
  const [shots, setShots] = useState(initialShots);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateShots(episodeId);
      toast.success(`成功生成 ${result.totalShots} 个镜头`);
      
      // 重新获取分镜列表
      const newShots = await getEpisodeShots(episodeId);
      setShots(newShots);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败");
      console.error(error);
    } finally {
      setGenerating(false);
    }
  }

  const handleShotUpdate = (shotId: string, updatedData: Partial<Shot>) => {
    setShots((prev) =>
      prev.map((shot) =>
        shot.id === shotId ? { ...shot, ...updatedData } : shot
      )
    );
  };

  const handleShotDelete = (shotId: string) => {
    setShots((prev) => prev.filter((shot) => shot.id !== shotId));
  };

  // 没有分镜时显示生成按钮
  if (shots.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-3">生成分镜脚本</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          让 AI 根据剧集大纲自动生成分镜脚本，包括景别、画面描述和台词
        </p>
        <Button onClick={handleGenerate} disabled={generating} size="lg">
          {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!generating && <Sparkles className="mr-2 h-4 w-4" />}
          {generating ? "AI 生成中..." : "开始生成"}
        </Button>
      </Card>
    );
  }

  // 有分镜时显示列表
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">分镜脚本</h3>
          <p className="text-sm text-muted-foreground">
            共 {shots.length} 个镜头
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!generating && <Sparkles className="mr-2 h-4 w-4" />}
            重新生成
          </Button>
          {/* TODO: 添加新增镜头按钮 */}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shots.map((shot) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            onUpdate={handleShotUpdate}
            onDelete={handleShotDelete}
          />
        ))}
      </div>
    </div>
  );
}

