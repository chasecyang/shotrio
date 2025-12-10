"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { 
  HelpCircle, 
  Sparkles, 
  Loader2, 
  Check, 
  AlertCircle, 
  X,
  LucideIcon 
} from "lucide-react";

// ============= Types =============
export type SaveStatus = "idle" | "saving" | "saved" | "error";

// ============= SaveStatusBadge Component =============
interface SaveStatusBadgeProps {
  status: SaveStatus;
  className?: string;
}

export function SaveStatusBadge({ status, className }: SaveStatusBadgeProps) {
  if (status === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-opacity",
        status === "saved" && "animate-in fade-in",
        className
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">保存中...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-3.5 h-3.5 text-green-600" />
          <span className="text-green-600">已保存</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          <span className="text-destructive">保存失败</span>
        </>
      )}
    </div>
  );
}

// ============= AIGenerationPanel Component =============
interface AIGenerationPanelProps {
  content: string | ReactNode;
  onAccept: () => void;
  onReject: () => void;
  className?: string;
}

export function AIGenerationPanel({
  content,
  onAccept,
  onReject,
  className,
}: AIGenerationPanelProps) {
  return (
    <div
      className={cn(
        "bg-purple-50/50 border border-purple-100 rounded-md p-2.5 space-y-2",
        "animate-in fade-in slide-in-from-top-1",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-purple-700 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          AI 建议
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={onAccept}
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            接受
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-muted-foreground hover:text-foreground"
            onClick={onReject}
          >
            <X className="w-3.5 h-3.5 mr-1" />
            拒绝
          </Button>
        </div>
      </div>
      <div className="text-sm text-foreground/80">
        {typeof content === "string" ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

// ============= EditableInput Component =============
interface EditableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  emptyText?: string;
  autoFocus?: boolean;
}

export function EditableInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  emptyText = "点击编辑",
  autoFocus = true,
}: EditableInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current && autoFocus) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, autoFocus]);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onChange(localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setLocalValue(value);
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
        className={cn("text-sm", inputClassName)}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "cursor-pointer group px-2.5 py-2 rounded-md border border-transparent",
        "hover:border-muted hover:bg-muted/30 transition-all",
        !value && "py-1.5",
        className
      )}
    >
      {value ? (
        <div className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          {value}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/60 italic">{emptyText}</div>
      )}
    </div>
  );
}

// ============= EditableTextarea Component =============
interface EditableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  emptyText?: string;
  rows?: number;
  minHeight?: string;
  autoFocus?: boolean;
}

export function EditableTextarea({
  value,
  onChange,
  placeholder,
  className,
  textareaClassName,
  emptyText = "点击编辑",
  rows = 3,
  minHeight = "min-h-[60px]",
  autoFocus = true,
}: EditableTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && textareaRef.current && autoFocus) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing, autoFocus]);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onChange(localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Textarea
        ref={textareaRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn("text-sm resize-none", textareaClassName)}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "cursor-pointer group px-2.5 py-2 rounded-md border border-transparent",
        "hover:border-muted hover:bg-muted/30 transition-all",
        value ? minHeight : "py-1.5",
        className
      )}
    >
      {value ? (
        <div className="text-sm text-muted-foreground group-hover:text-foreground transition-colors whitespace-pre-wrap">
          {value}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/60 italic">{emptyText}</div>
      )}
    </div>
  );
}

// ============= EditableField Container Component =============
interface EditableFieldProps {
  label: string;
  icon?: LucideIcon;
  tooltip?: string;
  saveStatus?: SaveStatus;
  onAIGenerate?: () => void;
  isAIGenerating?: boolean;
  aiButtonTitle?: string;
  children: ReactNode;
  className?: string;
}

export function EditableField({
  label,
  icon: Icon,
  tooltip,
  saveStatus = "idle",
  onAIGenerate,
  isAIGenerating = false,
  aiButtonTitle = "AI 生成/优化",
  children,
  className,
}: EditableFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
          <label className="text-xs font-medium text-foreground">
            {label}
          </label>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px]">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
          <SaveStatusBadge status={saveStatus} />
        </div>
        {onAIGenerate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            onClick={onAIGenerate}
            disabled={isAIGenerating}
            title={aiButtonTitle}
          >
            {isAIGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

