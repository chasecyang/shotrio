"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseAspectRatio } from "@/lib/utils/aspect-ratio";
import type { ExampleAssetPreview } from "@/lib/actions/example/public";
import { loadMoreExamples } from "@/lib/actions/example/public";

interface ExampleWaterfallProps {
  initialExamples: ExampleAssetPreview[];
  total: number;
}

export function ExampleWaterfall({ initialExamples, total }: ExampleWaterfallProps) {
  const [examples, setExamples] = useState(initialExamples);
  const [isLoading, setIsLoading] = useState(false);

  const hasMore = examples.length < total;

  const handleLoadMore = async () => {
    setIsLoading(true);
    try {
      const newExamples = await loadMoreExamples(examples.length, 12);
      setExamples([...examples, ...newExamples]);
    } catch (error) {
      console.error("加载更多失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (examples.length === 0) {
    return null;
  }

  return (
    <section className="py-8 md:py-12 bg-secondary/30">
      <div className="container px-4 mx-auto">
        {/* Waterfall Grid using CSS columns */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 mb-8">
          {examples.map((example) => (
            <div key={example.assetId} className="break-inside-avoid mb-6">
              <ExampleCard example={example} />
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && (
          <div className="flex justify-center">
            <Button
              onClick={handleLoadMore}
              disabled={isLoading}
              variant="outline"
              size="lg"
              className="min-w-[200px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  加载中...
                </>
              ) : (
                "加载更多"
              )}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function ExampleCard({ example }: { example: ExampleAssetPreview }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  const isVideo = example.assetType === "video";
  const displayName = example.displayName || example.assetName;

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current && isVideo && example.videoUrl) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // 计算宽高比用于容器
  // 如果没有宽高比数据，跳过该资产（不应该发生）
  if (!example.aspectRatio) {
    console.warn(`资产 ${example.assetId} 缺少宽高比数据`);
  }
  const aspectRatio = parseAspectRatio(example.aspectRatio || "1:1");
  const paddingBottom = `${(1 / aspectRatio) * 100}%`;

  return (
    <Card
      className="group overflow-hidden hover:shadow-xl hover:border-primary/30 p-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Media Container */}
      <div className="relative bg-black overflow-hidden" style={{ paddingBottom }}>
        {isVideo && example.videoUrl ? (
          <>
            {/* Thumbnail (default) */}
            {example.thumbnailUrl && (
              <Image
                src={example.thumbnailUrl}
                alt={displayName}
                fill
                className={cn(
                  "object-cover transition-opacity duration-300",
                  isHovering && isVideoLoaded ? "opacity-0" : "opacity-100"
                )}
              />
            )}
            {/* Video (hover) */}
            <video
              ref={videoRef}
              src={example.videoUrl}
              muted
              loop
              playsInline
              onLoadedData={() => setIsVideoLoaded(true)}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                isHovering && isVideoLoaded ? "opacity-100" : "opacity-0"
              )}
            />
            {/* Play indicator */}
            {!isHovering && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-primary">
                  <Play className="w-6 h-6 ml-0.5" />
                </div>
              </div>
            )}
          </>
        ) : example.imageUrl ? (
          <Image
            src={example.imageUrl}
            alt={displayName}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            暂无预览
          </div>
        )}
      </div>
    </Card>
  );
}
