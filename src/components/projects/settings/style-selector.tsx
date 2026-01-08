"use client";

import { ArtStyle } from "@/types/art-style";
import { Card } from "@/components/ui/card";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface StyleSelectorProps {
  styles: ArtStyle[];
  selectedStyleId?: string | null;
  onSelect: (styleId: string) => void;
}

export function StyleSelector({ styles, selectedStyleId, onSelect }: StyleSelectorProps) {
  const t = useTranslations("projects.assets");

  if (styles.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-center border-2 border-dashed rounded-lg">
        <div>
          <Palette className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{t("noStyles")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {styles.map((style) => {
        const isSelected = selectedStyleId === style.id;
        
        return (
          <Card
            key={style.id}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg overflow-hidden",
              isSelected && "ring-2 ring-primary border-primary"
            )}
            onClick={() => onSelect(style.id)}
          >
            {/* 预览图或占位符 */}
            <div className="relative h-32 bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
              {style.previewImage ? (
                <Image
                  src={style.previewImage}
                  alt={style.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <Palette className="w-12 h-12 text-muted-foreground/50" />
              )}
              
              {/* 选中标记 */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
            
            {/* 风格信息 */}
            <div className="p-4">
              <div className="mb-2">
                <h4 className="font-medium text-sm">{style.name}</h4>
                {style.nameEn && (
                  <p className="text-xs text-muted-foreground">{style.nameEn}</p>
                )}
              </div>
              
              {style.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {style.description}
                </p>
              )}
              
              {/* 标签 */}
              {style.tags && style.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {style.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

