import { useState } from "react";
import { Check, HelpCircle, Loader2, X, Sparkles } from "lucide-react";
import { EditableInput, EditableTextarea } from "./editable-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { SaveStatus } from "./hooks/use-auto-save";
import { generateStylePromptFromDescription, optimizeStylePrompt } from "@/lib/actions/character";
import { toast } from "sonner";

interface CharacterStyleInfoProps {
  label: string;
  imagePrompt: string;
  saveStatus: SaveStatus;
  characterId: string;
  onLabelChange: (value: string) => void;
  onImagePromptChange: (value: string) => void;
}

export function CharacterStyleInfo({
  label,
  imagePrompt,
  saveStatus,
  characterId,
  onLabelChange,
  onImagePromptChange,
}: CharacterStyleInfoProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);

  // AI生成描述（优化现有描述）
  const handleOptimizePrompt = async () => {
    if (!imagePrompt.trim()) {
      toast.error("请先输入一些描述内容");
      return;
    }

    setIsGenerating(true);
    setGeneratedPrompt(null);

    try {
      const result = await optimizeStylePrompt(characterId, imagePrompt);

      if (result.success && result.prompt) {
        setGeneratedPrompt(result.prompt);
        toast.success("AI 优化完成");
      } else {
        toast.error(result.error || "优化失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("优化失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  // AI生成描述（从零开始）
  const handleGeneratePrompt = async () => {
    const description = imagePrompt.trim() || label;
    if (!description) {
      toast.error("请先输入造型名称或简单描述");
      return;
    }

    setIsGenerating(true);
    setGeneratedPrompt(null);

    try {
      const result = await generateStylePromptFromDescription(
        characterId,
        description
      );

      if (result.success && result.prompt) {
        setGeneratedPrompt(result.prompt);
        toast.success("AI 生成完成");
      } else {
        toast.error(result.error || "生成失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  // 接受AI建议
  const handleAcceptPrompt = () => {
    if (generatedPrompt) {
      onImagePromptChange(generatedPrompt);
      setGeneratedPrompt(null);
    }
  };

  // 拒绝AI建议
  const handleRejectPrompt = () => {
    setGeneratedPrompt(null);
  };

  return (
    <div className="space-y-3">
      {/* 保存状态指示器 */}
      {saveStatus !== "idle" && (
        <div className="flex items-center gap-1.5">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">保存中</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600">已保存</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <X className="h-3 w-3 text-destructive" />
              <span className="text-xs text-destructive">保存失败</span>
            </>
          )}
        </div>
      )}

      {/* 造型标签 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          造型名称
        </label>
        <EditableInput
          value={label}
          onChange={onLabelChange}
          placeholder="例如：日常校服"
          emptyText="点击输入造型名称"
          className="text-sm font-medium"
        />
      </div>

      {/* 造型提示词 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            造型描述
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px]">
                造型描述应包含服装、姿势、表情等可变元素。固定外貌特征已在基础信息中设定。
              </TooltipContent>
            </Tooltip>
          </label>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            onClick={imagePrompt.trim() ? handleOptimizePrompt : handleGeneratePrompt}
            disabled={isGenerating}
            title={imagePrompt.trim() ? "AI 优化描述" : "AI 生成描述"}
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <EditableTextarea
          value={imagePrompt}
          onChange={onImagePromptChange}
          placeholder="例如：穿着校服，白色衬衫配深蓝色百褶裙，系着红色领结..."
          emptyText="点击输入造型描述"
          minHeight="min-h-[100px]"
        />

        {/* AI 生成结果预览区 */}
        {generatedPrompt && (
          <div className="bg-purple-50/50 border border-purple-100 rounded-md p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1">
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
                  onClick={handleAcceptPrompt}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  接受
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-muted-foreground hover:text-foreground"
                  onClick={handleRejectPrompt}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  拒绝
                </Button>
              </div>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">
              {generatedPrompt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
