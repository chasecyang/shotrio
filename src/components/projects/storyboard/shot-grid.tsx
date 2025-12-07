"use client";

import { useState, useEffect } from "react";
import { Episode, Character, ShotDetail } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Plus, Clapperboard, Loader2 } from "lucide-react";
import { getEpisodeShots, reorderShots, createShot } from "@/lib/actions/project";
import { ShotCard } from "./shot-card";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";

interface ShotGridProps {
  episode: Episode;
  characters: Character[];
}

export function ShotGrid({ episode, characters }: ShotGridProps) {
  const [shots, setShots] = useState<ShotDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const t = useTranslations("projects.storyboard");
  const tCommon = useTranslations("common");

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 加载分镜列表
  const loadShots = async () => {
    // 如果正在创建中，不显示全局loading，避免闪烁
    if (!isCreating) {
        setLoading(true);
    }
    const data = await getEpisodeShots(episode.id);
    setShots(data);
    setLoading(false);
  };

  useEffect(() => {
    loadShots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode.id]);

  const handleAddShot = async () => {
    setIsCreating(true);
    try {
        const result = await createShot({
            episodeId: episode.id,
            order: shots.length + 1,
            shotSize: "medium_shot", // 默认中景
            duration: 3000,
        });

        if (result.success) {
            toast.success("分镜创建成功");
            await loadShots();
        } else {
            toast.error(result.error || "创建失败");
        }
    } catch (error) {
        console.error(error);
        toast.error("创建失败，请重试");
    } finally {
        setIsCreating(false);
    }
  };

  // 处理拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = shots.findIndex((shot) => shot.id === active.id);
    const newIndex = shots.findIndex((shot) => shot.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 乐观更新UI
    const newShots = arrayMove(shots, oldIndex, newIndex);
    setShots(newShots);

    // 更新order字段
    const updatedOrders = newShots.map((shot, index) => ({
      id: shot.id,
      order: index + 1,
    }));

    // 保存到后端
    try {
      const result = await reorderShots(episode.id, updatedOrders);
      if (!result.success) {
        toast.error(result.error || "重新排序失败");
        // 失败时恢复原顺序
        loadShots();
      } else {
        toast.success("分镜顺序已更新");
      }
    } catch (error) {
      toast.error("重新排序失败，请重试");
      console.error(error);
      // 失败时恢复原顺序
      loadShots();
    }
  };

  if (loading && shots.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  // 空状态
  if (shots.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border rounded-lg p-8 text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Clapperboard className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">{t("noShots.title")}</h3>
          <p className="text-muted-foreground mb-6">
            {t("noShots.description", { title: episode.title })}
          </p>
          <Button onClick={handleAddShot} disabled={isCreating}>
            {isCreating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
                <Plus className="w-4 h-4 mr-2" />
            )}
            {t("noShots.action")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 分镜网格 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={shots.map((shot) => shot.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shots.map((shot) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                onUpdate={loadShots}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 添加分镜按钮 */}
      <div className="flex justify-center pt-4">
        <Button onClick={handleAddShot} variant="outline" size="lg" disabled={isCreating}>
            {isCreating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
                <Plus className="w-4 h-4 mr-2" />
            )}
          {t("addShot")}
        </Button>
      </div>
    </div>
  );
}


