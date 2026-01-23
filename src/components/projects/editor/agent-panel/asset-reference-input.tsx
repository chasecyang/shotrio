"use client";

import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from "react";
import { cn } from "@/lib/utils";
import { parseAssetReferences, createAssetReference } from "@/lib/utils/asset-reference";
import { ASSET_REFERENCE_CHIP_STYLES } from "@/lib/utils/asset-styles";

interface AssetReferenceInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: string;
}

export interface AssetReferenceInputHandle {
  focus: () => void;
}

/**
 * 输入框组件，支持将 [[name|id]] 格式的素材引用渲染成可视化的 chip
 */
export const AssetReferenceInput = forwardRef<AssetReferenceInputHandle, AssetReferenceInputProps>(
  function AssetReferenceInput(
    { value, onChange, onKeyDown, placeholder, className, disabled, maxHeight = "150px" },
    ref
  ) {
    const editableRef = useRef<HTMLDivElement>(null);
    const isComposingRef = useRef(false);

    useImperativeHandle(ref, () => ({
      focus: () => {
        editableRef.current?.focus();
      },
    }));

    // 从 DOM 提取文本值
    const extractValue = useCallback((): string => {
      if (!editableRef.current) return "";

      let text = "";
      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          // 过滤掉零宽空格
          const content = (node.textContent || "").replace(/\u200B/g, "");
          text += content;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.hasAttribute("data-asset-id")) {
            const name = el.getAttribute("data-asset-name") || "";
            const id = el.getAttribute("data-asset-id") || "";
            text += createAssetReference(name, id);
          } else {
            Array.from(node.childNodes).forEach(walk);
          }
        }
      };

      Array.from(editableRef.current.childNodes).forEach(walk);
      return text;
    }, []);

    // 渲染内容
    const renderContent = useCallback(() => {
      if (!editableRef.current) return;

      const references = parseAssetReferences(value);

      // 如果值为空，清空内容以显示 placeholder
      if (!value || value.trim() === "") {
        editableRef.current.innerHTML = "";
        return;
      }

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      references.forEach((ref) => {
        // 添加引用前的文本
        const textBefore = value.slice(lastIndex, ref.startIndex);
        if (textBefore) {
          fragment.appendChild(document.createTextNode(textBefore));
        }

        // 创建 chip
        const chip = document.createElement("span");
        chip.contentEditable = "false";
        chip.className = cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-xs",
          ASSET_REFERENCE_CHIP_STYLES,
          "cursor-default select-none"
        );
        chip.setAttribute("data-asset-id", ref.id);
        chip.setAttribute("data-asset-name", ref.name);
        chip.textContent = ref.name;
        fragment.appendChild(chip);

        lastIndex = ref.endIndex;
      });

      // 添加剩余文本
      const textAfter = value.slice(lastIndex);
      if (textAfter) {
        fragment.appendChild(document.createTextNode(textAfter));
      }

      // 保存光标位置
      const selection = window.getSelection();
      let savedRange: Range | null = null;
      if (selection && selection.rangeCount > 0 && editableRef.current.contains(selection.anchorNode)) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }

      // 更新内容
      editableRef.current.innerHTML = "";
      editableRef.current.appendChild(fragment);

      // 恢复光标（简化版本：放到末尾）
      if (savedRange && editableRef.current.childNodes.length > 0) {
        try {
          const range = document.createRange();
          const lastChild = editableRef.current.lastChild;
          if (lastChild) {
            if (lastChild.nodeType === Node.TEXT_NODE) {
              range.setStart(lastChild, lastChild.textContent?.length || 0);
            } else {
              range.setStartAfter(lastChild);
            }
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        } catch (e) {
          // 忽略光标恢复错误
        }
      }
    }, [value]);

    // 处理输入
    const handleInput = useCallback(() => {
      if (isComposingRef.current) return;
      const newValue = extractValue();
      if (newValue !== value) {
        onChange(newValue);
      }
    }, [extractValue, value, onChange]);

    // 处理键盘事件
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!editableRef.current) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);

      // 处理 Backspace：删除前面的 chip
      if (e.key === "Backspace") {
        const { startContainer, startOffset } = range;

        // 检查光标前是否是 chip
        if (startOffset === 0 && startContainer.previousSibling) {
          const prev = startContainer.previousSibling as HTMLElement;
          if (prev.hasAttribute && prev.hasAttribute("data-asset-id")) {
            e.preventDefault();

            // 保存当前光标所在的节点
            const currentNode = startContainer;

            // 删除 chip
            prev.remove();

            // 立即恢复光标到当前位置
            try {
              const newRange = document.createRange();
              newRange.setStart(currentNode, 0);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            } catch (e) {
              // 忽略错误
            }

            // 触发更新
            handleInput();
            return;
          }
        }

        // 检查父节点前是否是 chip
        if (startOffset === 0 && startContainer.parentElement !== editableRef.current) {
          const parent = startContainer.parentElement;
          if (parent?.previousSibling) {
            const prev = parent.previousSibling as HTMLElement;
            if (prev.hasAttribute && prev.hasAttribute("data-asset-id")) {
              e.preventDefault();

              // 保存当前光标所在的节点
              const currentNode = startContainer;

              // 删除 chip
              prev.remove();

              // 立即恢复光标到当前位置
              try {
                const newRange = document.createRange();
                newRange.setStart(currentNode, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
              } catch (e) {
                // 忽略错误
              }

              // 触发更新
              handleInput();
              return;
            }
          }
        }
      }

      // 处理 Delete：删除后面的 chip
      if (e.key === "Delete") {
        const { endContainer, endOffset } = range;
        const textLength = endContainer.textContent?.length || 0;

        if (endOffset === textLength && endContainer.nextSibling) {
          const next = endContainer.nextSibling as HTMLElement;
          if (next.hasAttribute && next.hasAttribute("data-asset-id")) {
            e.preventDefault();

            // 保存当前光标所在的节点
            const currentNode = endContainer;
            const currentOffset = endOffset;

            // 删除 chip
            next.remove();

            // 立即恢复光标到当前位置
            try {
              const newRange = document.createRange();
              newRange.setStart(currentNode, currentOffset);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            } catch (e) {
              // 忽略错误
            }

            // 触发更新
            handleInput();
            return;
          }
        }
      }

      // 传递给父组件
      onKeyDown?.(e);
    }, [handleInput, onKeyDown]);

    // 处理粘贴
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    }, []);

    // 处理输入法
    const handleCompositionStart = useCallback(() => {
      isComposingRef.current = true;
    }, []);

    const handleCompositionEnd = useCallback(() => {
      isComposingRef.current = false;
      handleInput();
    }, [handleInput]);

    // 值变化时重新渲染
    useEffect(() => {
      if (!editableRef.current) return;
      const currentValue = extractValue();

      // 只有当提取的值与新值不同时才重新渲染
      // 这避免了在用户输入时不必要的重新渲染
      if (currentValue !== value) {
        renderContent();
      }
    }, [value, extractValue, renderContent]);

    // 初始渲染
    useEffect(() => {
      renderContent();
    }, [renderContent]);

    return (
      <div className="relative w-full">
        {/* Placeholder overlay */}
        {(!value || value.trim() === "") && placeholder && (
          <div
            className="absolute inset-0 p-2 text-sm text-muted-foreground pointer-events-none flex items-start"
            style={{ maxHeight }}
          >
            {placeholder}
          </div>
        )}

        <div
          ref={editableRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          className={cn(
            "min-h-[40px] w-full p-2 bg-transparent",
            "focus:outline-none whitespace-pre-wrap break-words overflow-y-auto",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          style={{ maxHeight }}
          suppressContentEditableWarning
        />
      </div>
    );
  }
);
