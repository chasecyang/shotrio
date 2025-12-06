"use client";

/**
 * 图片上传组件
 * 
 * 支持拖拽上传、点击选择文件、预览、删除等功能
 */

import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getImageSrc } from "@/lib/utils";
import { uploadImage, deleteImage } from "@/lib/actions/upload-actions";
import { ImageCategory } from "@/lib/storage";
import Image from "next/image";

interface ImageUploadProps {
  /**
   * 当前图片 URL
   */
  value?: string;
  
  /**
   * 图片变化回调
   */
  onChange?: (url: string | undefined) => void;
  
  /**
   * 图片分类
   */
  category?: ImageCategory;
  
  /**
   * 占位符文本
   */
  placeholder?: string;
  
  /**
   * 是否禁用
   */
  disabled?: boolean;
  
  /**
   * 自定义类名
   */
  className?: string;
  
  /**
   * 预览图尺寸
   */
  previewSize?: "sm" | "md" | "lg";
}

export function ImageUpload({
  value,
  onChange,
  category = ImageCategory.OTHER,
  placeholder = "点击或拖拽上传图片",
  disabled = false,
  className,
  previewSize = "md",
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件上传
  const handleUpload = async (file: File) => {
    try {
      setError(undefined);
      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadImage(formData, category);

      if (result.success && result.url) {
        onChange?.(result.url);
      } else {
        setError(result.error || "上传失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  // 处理文件选择
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  // 处理拖拽进入
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  // 处理拖拽离开
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // 处理拖拽经过
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 处理文件放下
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  // 处理删除
  const handleDelete = async () => {
    if (!value) return;

    try {
      setIsUploading(true);
      await deleteImage(value);
      onChange?.(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsUploading(false);
    }
  };

  // 点击上传区域
  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  // 预览图尺寸样式
  const sizeClasses = {
    sm: "h-24 w-24",
    md: "h-40 w-40",
    lg: "h-56 w-56",
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* 上传区域 */}
      {!value && (
        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center",
            "rounded-lg border-2 border-dashed",
            "cursor-pointer transition-all",
            "hover:border-primary/50 hover:bg-neutral-50",
            sizeClasses[previewSize],
            isDragging && "border-primary bg-primary/5",
            disabled && "cursor-not-allowed opacity-50",
            isUploading && "cursor-wait"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={disabled || isUploading}
            className="hidden"
          />

          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <>
              <Upload className="h-8 w-8 text-neutral-400 mb-2" />
              <p className="text-sm text-neutral-500 text-center px-2">
                {placeholder}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                支持 JPG, PNG, WEBP, GIF
              </p>
            </>
          )}
        </div>
      )}

      {/* 预览区域 */}
      {value && (
        <div className={cn("relative group", sizeClasses[previewSize])}>
          <Image
            src={getImageSrc(value)}
            alt="预览"
            fill
            className="object-cover rounded-lg border border-neutral-200"
          />

          {/* 删除按钮 */}
          {!disabled && !isUploading && (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={handleDelete}
              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {/* 加载状态 */}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

/**
 * 简单的图片预览组件（仅用于显示，不支持上传）
 */
interface ImagePreviewProps {
  src?: string;
  alt?: string;
  fallback?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ImagePreview({
  src,
  alt = "图片",
  fallback,
  className,
  size = "md",
}: ImagePreviewProps) {
  const sizeClasses = {
    sm: "h-24 w-24",
    md: "h-40 w-40",
    lg: "h-56 w-56",
  };

  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50",
          sizeClasses[size],
          className
        )}
      >
        {fallback || <ImageIcon className="h-8 w-8 text-neutral-300" />}
      </div>
    );
  }

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <Image
        src={getImageSrc(src)}
        alt={alt}
        fill
        className="object-cover rounded-lg border border-neutral-200"
      />
    </div>
  );
}

