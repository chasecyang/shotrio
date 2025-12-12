"use client";

import { useEffect, useCallback } from "react";
import { useEditor } from "./editor-context";
import { deleteShot, getEpisodeShots } from "@/lib/actions/project";
import { toast } from "sonner";

export function useEditorKeyboard() {
  const { state, dispatch, selectShot, clearShotSelection, setPlaying, setPlayhead, totalDuration } = useEditor();
  const { shots, selectedShotIds, timeline, selectedEpisodeId } = state;

  // 删除选中的分镜
  const handleDeleteSelected = useCallback(async () => {
    if (selectedShotIds.length === 0) return;

    try {
      for (const shotId of selectedShotIds) {
        await deleteShot(shotId);
      }
      toast.success(`已删除 ${selectedShotIds.length} 个分镜`);
      clearShotSelection();

      // 重新加载分镜
      if (selectedEpisodeId) {
        const newShots = await getEpisodeShots(selectedEpisodeId);
        dispatch({ type: "SET_SHOTS", payload: newShots });
      }
    } catch (error) {
      console.error(error);
      toast.error("删除失败");
    }
  }, [selectedShotIds, selectedEpisodeId, clearShotSelection, dispatch]);

  // 选择上一个/下一个分镜
  const selectAdjacentShot = useCallback(
    (direction: "prev" | "next") => {
      if (shots.length === 0) return;

      const currentId = selectedShotIds[selectedShotIds.length - 1];
      const currentIndex = currentId ? shots.findIndex((s) => s.id === currentId) : -1;

      let newIndex: number;
      if (direction === "prev") {
        newIndex = currentIndex <= 0 ? shots.length - 1 : currentIndex - 1;
      } else {
        newIndex = currentIndex >= shots.length - 1 ? 0 : currentIndex + 1;
      }

      selectShot(shots[newIndex].id);
    },
    [shots, selectedShotIds, selectShot]
  );

  // 全选
  const selectAll = useCallback(() => {
    if (shots.length === 0) return;
    const allIds = shots.map((s) => s.id);
    dispatch({ type: "SELECT_SHOTS", payload: allIds });
  }, [shots, dispatch]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果在输入框中，不处理快捷键
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        // 删除
        case "Delete":
        case "Backspace":
          if (selectedShotIds.length > 0) {
            e.preventDefault();
            handleDeleteSelected();
          }
          break;

        // 方向键选择
        case "ArrowLeft":
          e.preventDefault();
          selectAdjacentShot("prev");
          break;

        case "ArrowRight":
          e.preventDefault();
          selectAdjacentShot("next");
          break;

        // 播放/暂停
        case " ":
          e.preventDefault();
          setPlaying(!timeline.isPlaying);
          break;

        // 跳到开头
        case "Home":
          e.preventDefault();
          setPlayhead(0);
          break;

        // 跳到结尾
        case "End":
          e.preventDefault();
          setPlayhead(totalDuration);
          break;

        // 全选 Ctrl/Cmd + A
        case "a":
        case "A":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            selectAll();
          }
          break;

        // 取消选择 Escape
        case "Escape":
          e.preventDefault();
          clearShotSelection();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedShotIds,
    timeline.isPlaying,
    totalDuration,
    handleDeleteSelected,
    selectAdjacentShot,
    selectAll,
    clearShotSelection,
    setPlaying,
    setPlayhead,
  ]);
}

