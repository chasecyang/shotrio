"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface EditableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  emptyText?: string;
}

/**
 * 可编辑的单行输入框
 * 点击进入编辑模式，失焦或按 ESC 退出编辑
 */
export function EditableInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  emptyText = "点击编辑",
}: EditableInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onChange(localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setLocalValue(value); // 恢复原值
      setIsEditing(false);
    } else if (e.key === "Enter") {
      handleBlur();
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("font-medium", inputClassName)}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "cursor-pointer group px-3 py-2 rounded-md border border-transparent",
        "hover:border-muted hover:bg-muted/30 transition-all",
        className
      )}
    >
      {value ? (
        <div className="font-medium group-hover:text-foreground transition-colors">
          {value}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground/60 italic">{emptyText}</div>
      )}
    </div>
  );
}

interface EditableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  emptyText?: string;
  minHeight?: string;
  label?: string;
}

/**
 * 可编辑的多行文本框
 * 点击进入编辑模式，失焦或按 ESC 退出编辑
 */
export function EditableTextarea({
  value,
  onChange,
  placeholder,
  className,
  textareaClassName,
  emptyText = "点击编辑",
  minHeight = "min-h-[120px]",
  label,
}: EditableTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // 光标移到末尾
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onChange(localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setLocalValue(value); // 恢复原值
      setIsEditing(false);
    }
    // 不处理 Enter，因为多行文本需要换行
  };

  if (isEditing) {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-muted-foreground">
            {label}
          </label>
        )}
        <Textarea
          ref={textareaRef}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("resize-none", minHeight, textareaClassName)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div
        onClick={handleClick}
        className={cn(
          "cursor-pointer group px-3 py-2 rounded-md border border-transparent",
          "hover:border-muted hover:bg-muted/30 transition-all",
          value ? minHeight : "py-2",
          className
        )}
      >
        {value ? (
          <div className="text-sm text-muted-foreground group-hover:text-foreground transition-colors whitespace-pre-wrap">
            {value}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground/60 italic">{emptyText}</div>
        )}
      </div>
    </div>
  );
}
