"use client";

import { useEffect } from "react";

export function useEditorKeyboard() {
  // 键盘事件处理（预留，目前新布局暂不需要特殊快捷键）
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

      // 预留快捷键处理逻辑
      switch (e.key) {
        case "Escape":
          // 可以用于关闭对话框等
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

