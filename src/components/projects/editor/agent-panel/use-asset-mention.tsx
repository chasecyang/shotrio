"use client";

import { useState, useCallback, useEffect } from "react";
import { createAssetReference } from "@/lib/utils/asset-reference";
import type { AssetWithFullData } from "@/types/asset";

export interface MentionState {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number } | null;
  triggerIndex: number;
}

export interface UseAssetMentionProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>;
  value: string;
  onChange: (value: string) => void;
  assets: AssetWithFullData[];
  isContentEditable?: boolean;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
}

export function useAssetMention({
  textareaRef,
  value,
  onChange,
  assets,
  isContentEditable = false,
  dropdownRef,
}: UseAssetMentionProps) {
  const [mentionState, setMentionState] = useState<MentionState>({
    isOpen: false,
    query: "",
    position: null,
    triggerIndex: -1,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter assets based on mention query
  const filteredAssets = mentionState.isOpen
    ? assets.filter((asset) =>
        asset.name.toLowerCase().includes(mentionState.query.toLowerCase())
      )
    : [];

  // Get cursor position for contentEditable
  const getCursorPositionInContentEditable = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();

    if (!textareaRef.current) return 0;
    preCaretRange.selectNodeContents(textareaRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    return preCaretRange.toString().length;
  }, [textareaRef]);

  // Calculate dropdown position based on cursor
  const calculatePosition = useCallback(() => {
    if (!textareaRef.current) return null;

    if (isContentEditable) {
      // For contentEditable, use Selection API
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Find the contentEditable element within the container
      const contentEditableEl = textareaRef.current.querySelector('[contenteditable="true"]') as HTMLElement;
      const containerRect = contentEditableEl
        ? contentEditableEl.getBoundingClientRect()
        : textareaRef.current.getBoundingClientRect();

      return {
        top: rect.bottom - containerRect.top,
        left: rect.left - containerRect.left,
      };
    } else {
      // For textarea
      const textarea = textareaRef.current as HTMLTextAreaElement;
      const { selectionStart } = textarea;

      // Create a mirror div to calculate cursor position
      const mirror = document.createElement("div");
      const computed = window.getComputedStyle(textarea);

      // Copy textarea styles to mirror
      mirror.style.position = "absolute";
      mirror.style.visibility = "hidden";
      mirror.style.whiteSpace = "pre-wrap";
      mirror.style.wordWrap = "break-word";
      mirror.style.font = computed.font;
      mirror.style.padding = computed.padding;
      mirror.style.border = computed.border;
      mirror.style.width = computed.width;

      // Get text up to cursor
      const textBeforeCursor = value.substring(0, selectionStart);
      mirror.textContent = textBeforeCursor;

      // Add a span to measure cursor position
      const span = document.createElement("span");
      span.textContent = "|";
      mirror.appendChild(span);

      document.body.appendChild(mirror);

      const rect = textarea.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();

      document.body.removeChild(mirror);

      return {
        top: spanRect.top - rect.top + textarea.scrollTop,
        left: spanRect.left - rect.left,
      };
    }
  }, [textareaRef, value, isContentEditable]);

  // Handle input changes to detect @ mentions
  const handleInputChange = useCallback(
    (newValue: string) => {
      onChange(newValue);

      if (!textareaRef.current) return;

      let cursorPosition: number;

      if (isContentEditable) {
        cursorPosition = getCursorPositionInContentEditable();
      } else {
        const textarea = textareaRef.current as HTMLTextAreaElement;
        cursorPosition = textarea.selectionStart;
      }

      const textBeforeCursor = newValue.substring(0, cursorPosition);

      // Find the last @ symbol before cursor
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      // Check if we're in a mention context
      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

        // Only trigger if there's no space after @ and we're still typing
        if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
          const position = calculatePosition();

          setMentionState({
            isOpen: true,
            query: textAfterAt,
            position,
            triggerIndex: lastAtIndex,
          });
          setSelectedIndex(0);
          return;
        }
      }

      // Close mention dropdown if conditions not met
      if (mentionState.isOpen) {
        setMentionState({
          isOpen: false,
          query: "",
          position: null,
          triggerIndex: -1,
        });
      }
    },
    [onChange, textareaRef, calculatePosition, mentionState.isOpen, isContentEditable, getCursorPositionInContentEditable]
  );

  // Insert asset reference at mention position
  const insertAssetReference = useCallback(
    (asset: AssetWithFullData) => {
      if (!textareaRef.current || mentionState.triggerIndex === -1) return;

      const reference = createAssetReference(asset.name, asset.id);

      let cursorPosition: number;

      if (isContentEditable) {
        cursorPosition = getCursorPositionInContentEditable();
      } else {
        const textarea = textareaRef.current as HTMLTextAreaElement;
        cursorPosition = textarea.selectionStart;
      }

      // Replace @query with reference token
      const before = value.substring(0, mentionState.triggerIndex);
      const after = value.substring(cursorPosition);
      const newValue = before + reference + " " + after;

      onChange(newValue);

      // Close mention dropdown
      setMentionState({
        isOpen: false,
        query: "",
        position: null,
        triggerIndex: -1,
      });

      // Set cursor position after reference
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = before.length + reference.length + 1;

          if (isContentEditable) {
            // For contentEditable, set cursor using Selection API
            const selection = window.getSelection();
            if (selection) {
              const range = document.createRange();
              const textNode = findTextNodeAtPosition(textareaRef.current, newCursorPos);
              if (textNode) {
                range.setStart(textNode.node, textNode.offset);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
              }
            }
          } else {
            const textarea = textareaRef.current as HTMLTextAreaElement;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
          }
        }
      }, 0);
    },
    [textareaRef, mentionState.triggerIndex, value, onChange, isContentEditable, getCursorPositionInContentEditable]
  );

  // Helper function to find text node at a specific position in contentEditable
  const findTextNodeAtPosition = (element: HTMLElement, position: number): { node: Node; offset: number } | null => {
    let currentPos = 0;

    const walk = (node: Node): { node: Node; offset: number } | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        if (currentPos + textLength >= position) {
          return { node, offset: position - currentPos };
        }
        currentPos += textLength;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (const child of Array.from(node.childNodes)) {
          const result = walk(child);
          if (result) return result;
        }
      }
      return null;
    };

    return walk(element);
  };

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
      if (!mentionState.isOpen || filteredAssets.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredAssets.length - 1 ? prev + 1 : prev
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case "Enter":
          if (mentionState.isOpen) {
            e.preventDefault();
            const selectedAsset = filteredAssets[selectedIndex];
            if (selectedAsset) {
              insertAssetReference(selectedAsset);
            }
          }
          break;

        case "Escape":
          e.preventDefault();
          setMentionState({
            isOpen: false,
            query: "",
            position: null,
            triggerIndex: -1,
          });
          break;
      }
    },
    [mentionState.isOpen, filteredAssets, selectedIndex, insertAssetReference]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mentionState.isOpen) {
        // Check if click is inside the dropdown
        if (dropdownRef?.current && dropdownRef.current.contains(event.target as Node)) {
          return;
        }

        // Check if click is inside the textarea/input
        if (textareaRef.current && textareaRef.current.contains(event.target as Node)) {
          return;
        }

        setMentionState({
          isOpen: false,
          query: "",
          position: null,
          triggerIndex: -1,
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mentionState.isOpen, dropdownRef, textareaRef]);

  return {
    mentionState,
    filteredAssets,
    selectedIndex,
    handleInputChange,
    handleKeyDown,
    insertAssetReference,
  };
}
