"use client";

import { ArtStyle } from "@/types/art-style";
import { Palette } from "lucide-react";
import Image from "next/image";

interface TemplateButtonProps {
  style: ArtStyle;
  onClick: () => void;
}

export function TemplateButton({ style, onClick }: TemplateButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-primary hover:bg-accent transition-colors"
    >
      <div className="w-12 h-12 rounded overflow-hidden bg-gradient-to-br from-primary/10 to-purple-500/10">
        {style.previewImage ? (
          <Image
            src={style.previewImage}
            alt={style.name}
            width={48}
            height={48}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Palette className="w-6 h-6 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <span className="text-xs text-center line-clamp-2 w-full">{style.name}</span>
    </button>
  );
}
