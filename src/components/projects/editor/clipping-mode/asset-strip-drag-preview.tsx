"use client";

import { createPortal } from "react-dom";
import { AssetWithFullData } from "@/types/asset";
import { Video, AudioLines } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface AssetStripDragPreviewProps {
  asset: AssetWithFullData | null;
  position: { x: number; y: number } | null;
}

/**
 * 拖拽预览 - 跟随鼠标的浮动素材缩略图
 * 使用 Portal 渲染到 body，避免被其他元素遮挡
 */
export function AssetStripDragPreview({ asset, position }: AssetStripDragPreviewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!asset || !position || !mounted) {
    return null;
  }

  const content = (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: position.x - 28, // 居中显示（56/2 = 28）
        top: position.y - 28,
        transform: "translate(0, 0)", // 使用 GPU 加速
      }}
    >
      <div
        className="rounded-lg border-2 border-primary bg-card overflow-hidden shadow-2xl"
        style={{ width: 56, height: 56 }}
      >
        {asset.displayUrl && asset.assetType === "video" ? (
          <Image
            src={asset.displayUrl}
            alt={asset.name}
            fill
            className="object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            {asset.assetType === "video" ? (
              <Video className="h-5 w-5 text-muted-foreground" />
            ) : (
              <AudioLines className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}

        {/* 时长标签 */}
        {asset.duration && (
          <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-[10px] bg-black/70 text-white font-medium">
            {Math.floor(asset.duration / 1000)}s
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
