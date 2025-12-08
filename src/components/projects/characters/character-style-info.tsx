import { Check, HelpCircle, Loader2, X } from "lucide-react";
import { EditableInput, EditableTextarea } from "./editable-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SaveStatus } from "./hooks/use-auto-save";

interface CharacterStyleInfoProps {
  label: string;
  imagePrompt: string;
  saveStatus: SaveStatus;
  onLabelChange: (value: string) => void;
  onImagePromptChange: (value: string) => void;
}

export function CharacterStyleInfo({
  label,
  imagePrompt,
  saveStatus,
  onLabelChange,
  onImagePromptChange,
}: CharacterStyleInfoProps) {
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
        <EditableTextarea
          value={imagePrompt}
          onChange={onImagePromptChange}
          placeholder="例如：穿着校服，白色衬衫配深蓝色百褶裙，系着红色领结..."
          emptyText="点击输入造型描述"
          minHeight="min-h-[100px]"
        />
      </div>
    </div>
  );
}
