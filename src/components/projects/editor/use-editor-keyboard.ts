"use client";

import { useEffect } from "react";
import { useEditor } from "./editor-context";

export function useEditorKeyboard() {
  const { state } = useEditor();
  const { selectedEpisodeId } = state;


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
        // 方向键选择
        case "ArrowLeft":
          e.preventDefault();
          break;

        case "ArrowRight":
          e.preventDefault();
          break;

        // 跳到开头
        case "Home":
          e.preventDefault();
          break;

        // 跳到结尾
        case "End":
          e.preventDefault();
          break;

        // 全选 Ctrl/Cmd + A
        case "a":
        case "A":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
          }
          break;

        // 取消选择 Escape
        case "Escape":
          e.preventDefault();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedEpisodeId,
  ]);
}

