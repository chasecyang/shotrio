"use client";

import { ArtStyle } from "@/types/art-style";
import { Card } from "@/components/ui/card";
import { Palette } from "lucide-react";
import Image from "next/image";

interface TemplateCardProps {
  style: ArtStyle;
  onSelect: () => void;
}

export function TemplateCard({ style, onSelect }: TemplateCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg overflow-hidden"
      onClick={onSelect}
    >
      {/* 预览图 */}
      <div className="relative h-24 bg-gradient-to-br from-primary/10 to-purple-500/10">
        {style.previewImage ? (
          <Image
            src={style.previewImage}
            alt={style.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Palette className="w-8 h-8 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* 风格信息 */}
      <div className="p-3 space-y-1">
        <h4 className="font-medium text-sm">{style.name}</h4>
        {style.nameEn && (
          <p className="text-xs text-muted-foreground">{style.nameEn}</p>
        )}
        {style.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {style.description}
          </p>
        )}
      </div>
    </Card>
  );
}
