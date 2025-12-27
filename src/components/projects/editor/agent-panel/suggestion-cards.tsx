"use client";

import { useTranslations } from "next-intl";
import { 
  ImagePlus, 
  Layers
} from "lucide-react";
import { LucideIcon } from "lucide-react";

interface SuggestionItem {
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  promptKey: string;
  gradient: string; // 每个卡片独特的渐变色
}

interface SuggestionCardsProps {
  onSelectSuggestion: (text: string) => void;
}

export function SuggestionCards({ onSelectSuggestion }: SuggestionCardsProps) {
  const t = useTranslations();

  // 建议配置：图标 + 国际化键 + 独特渐变
  const suggestions: SuggestionItem[] = [
    {
      icon: ImagePlus,
      titleKey: "editor.agent.panel.suggestions.items.0.title",
      descriptionKey: "editor.agent.panel.suggestions.items.0.description",
      promptKey: "editor.agent.panel.suggestions.items.0.prompt",
      gradient: "from-blue-500/10 to-cyan-500/10",
    },
    {
      icon: Layers,
      titleKey: "editor.agent.panel.suggestions.items.1.title",
      descriptionKey: "editor.agent.panel.suggestions.items.1.description",
      promptKey: "editor.agent.panel.suggestions.items.1.prompt",
      gradient: "from-violet-500/10 to-purple-500/10",
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-2">
      {/* 标题 */}
      <div className="text-center mb-6">
        <h3 className="text-base font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t("editor.agent.panel.suggestions.title")}
        </h3>
      </div>

      {/* 建议卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-500">
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon;
          const title = t(suggestion.titleKey);
          const description = t(suggestion.descriptionKey);
          const prompt = t(suggestion.promptKey);

          return (
            <button
              key={index}
              onClick={() => onSelectSuggestion(prompt)}
              className="group relative p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all duration-300 text-left overflow-hidden hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 active:translate-y-0"
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {/* 装饰性渐变背景 - 使用独特的渐变色 */}
              <div className={`absolute inset-0 bg-gradient-to-br ${suggestion.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              
              {/* 边缘高光效果 */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
              
              {/* 内容 */}
              <div className="relative z-10">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 group-hover:scale-110 flex items-center justify-center transition-all duration-300">
                    <Icon className="h-5 w-5 text-primary group-hover:rotate-3 transition-transform duration-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors duration-300">
                      {title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>
              </div>

              {/* 微妙的点击提示 */}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-70 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                <div className="text-[10px] text-primary font-medium">
                  {t("editor.agent.panel.suggestions.clickToUse")} →
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

