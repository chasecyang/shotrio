import { useState } from "react";
import { Tag, Palette } from "lucide-react";
import { 
  EditableField, 
  EditableInput, 
  EditableTextarea, 
  AIGenerationPanel,
  SaveStatus 
} from "@/components/ui/inline-editable-field";
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
      {/* 造型标签 */}
      <EditableField
        label="造型名称"
        icon={Tag}
        saveStatus={saveStatus}
      >
        <EditableInput
          value={label}
          onChange={onLabelChange}
          placeholder="例如：日常校服"
          emptyText="点击输入造型名称"
        />
      </EditableField>

      {/* 造型提示词 */}
      <EditableField
        label="造型描述"
        icon={Palette}
        tooltip="造型描述应包含服装、姿势、表情等可变元素。固定外貌特征已在基础信息中设定。"
        saveStatus={saveStatus}
        onAIGenerate={imagePrompt.trim() ? handleOptimizePrompt : handleGeneratePrompt}
        isAIGenerating={isGenerating}
        aiButtonTitle={imagePrompt.trim() ? "AI 优化描述" : "AI 生成描述"}
      >
        <EditableTextarea
          value={imagePrompt}
          onChange={onImagePromptChange}
          placeholder="例如：穿着校服，白色衬衫配深蓝色百褶裙，系着红色领结..."
          emptyText="点击输入造型描述"
          minHeight="min-h-[100px]"
        />
      </EditableField>

      {/* AI 生成结果预览区 */}
      {generatedPrompt && (
        <AIGenerationPanel
          content={generatedPrompt}
          onAccept={handleAcceptPrompt}
          onReject={handleRejectPrompt}
        />
      )}
    </div>
  );
}
