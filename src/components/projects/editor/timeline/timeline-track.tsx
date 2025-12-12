"use client";

import { useRef, useState, useCallback } from "react";
import { ShotDetail } from "@/types/project";
import { useEditor } from "../editor-context";
import { ShotClip } from "./shot-clip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Clapperboard, Plus } from "lucide-react";
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
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { reorderShots, getEpisodeShots } from "@/lib/actions/project";
import { toast } from "sonner";

interface TimelineTrackProps {
  shots: ShotDetail[];
  isLoading: boolean;
  onAddShot?: () => void;
}

export function TimelineTrack({ shots, isLoading, onAddShot }: TimelineTrackProps) {
  const { state, dispatch, selectShot, toggleShotSelection } = useEditor();
  const { timeline, selectedShotIds, selectedEpisodeId } = state;
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pixelsPerMs = 0.1 * timeline.zoom;

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

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = shots.findIndex((shot) => shot.id === active.id);
      const newIndex = shots.findIndex((shot) => shot.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1 && selectedEpisodeId) {
        // 乐观更新 UI
        const newShots = arrayMove(shots, oldIndex, newIndex);
        dispatch({ type: "SET_SHOTS", payload: newShots });

        // 保存到服务器
        try {
          const shotOrders = newShots.map((shot, index) => ({
            id: shot.id,
            order: index + 1,
          }));
          const result = await reorderShots(selectedEpisodeId, shotOrders);
          
          if (!result.success) {
            // 恢复原始顺序
            dispatch({ type: "SET_SHOTS", payload: shots });
            toast.error(result.error || "排序失败");
          }
        } catch (error) {
          console.error(error);
          dispatch({ type: "SET_SHOTS", payload: shots });
          toast.error("排序失败");
        }
      }
    }
  };

  const handleShotClick = useCallback(
    (shotId: string, event: React.MouseEvent) => {
      if (isDragging) return;

      if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd + 点击：切换选中
        toggleShotSelection(shotId);
      } else if (event.shiftKey && selectedShotIds.length > 0) {
        // Shift + 点击：范围选择
        const lastSelectedId = selectedShotIds[selectedShotIds.length - 1];
        const lastIndex = shots.findIndex((s) => s.id === lastSelectedId);
        const currentIndex = shots.findIndex((s) => s.id === shotId);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeIds = shots.slice(start, end + 1).map((s) => s.id);
          dispatch({ type: "SELECT_SHOTS", payload: rangeIds });
        }
      } else {
        // 普通点击：单选
        selectShot(shotId);
      }
    },
    [isDragging, selectedShotIds, shots, toggleShotSelection, selectShot, dispatch]
  );

  if (isLoading) {
    return (
      <div className="flex-1 p-3 flex gap-2 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-32 shrink-0 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (shots.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Clapperboard className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">暂无分镜</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddShot}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            添加分镜
          </Button>
        </div>
      </div>
    );
  }

  // 计算总宽度
  const totalWidth = shots.reduce((acc, shot) => acc + (shot.duration || 3000) * pixelsPerMs, 0);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={trackRef}
        className="flex-1 overflow-x-auto overflow-y-hidden p-3"
      >
        <div
          className="h-full flex gap-1 items-stretch"
          style={{ width: `${Math.max(totalWidth + 100, 100)}px`, minWidth: "100%" }}
        >
          <SortableContext
            items={shots.map((shot) => shot.id)}
            strategy={horizontalListSortingStrategy}
          >
            {shots.map((shot) => (
              <ShotClip
                key={shot.id}
                shot={shot}
                isSelected={selectedShotIds.includes(shot.id)}
                pixelsPerMs={pixelsPerMs}
                onClick={(e) => handleShotClick(shot.id, e)}
              />
            ))}
          </SortableContext>
        </div>
      </div>
    </DndContext>
  );
}

