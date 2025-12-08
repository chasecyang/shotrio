import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CharacterImage } from "@/types/project";
import { CharacterImageDisplay } from "./character-image-display";
import { CharacterStyleInfo } from "./character-style-info";
import { SaveStatus } from "./hooks/use-auto-save";
import { 
  generateImageForCharacterStyle, 
  setCharacterPrimaryImage,
  deleteCharacterImage 
} from "@/lib/actions/character";
import { toast } from "sonner";

interface CharacterStyleTabProps {
  image: CharacterImage;
  projectId: string;
  characterId: string;
  styleLabel: string;
  imagePrompt: string;
  saveStatus: SaveStatus;
  onLabelChange: (value: string) => void;
  onImagePromptChange: (value: string) => void;
  onPreview: () => void;
  onDeleted: () => void;
}

export function CharacterStyleTab({
  image,
  projectId,
  characterId,
  styleLabel,
  imagePrompt,
  saveStatus,
  onLabelChange,
  onImagePromptChange,
  onPreview,
  onDeleted,
}: CharacterStyleTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleGenerate = async () => {
    try {
      const result = await generateImageForCharacterStyle(projectId, characterId, image.id);
      if (result.success) {
        toast.success("已提交图片生成任务");
      } else {
        toast.error(result.error || "提交任务失败");
      }
    } catch {
      toast.error("提交任务出错");
    }
  };

  const handleSetPrimary = async () => {
    try {
      await setCharacterPrimaryImage(projectId, characterId, image.id);
      toast.success("已设为主图");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.error("设置失败");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定要删除「${styleLabel}」吗？`)) return;
    try {
      await deleteCharacterImage(projectId, image.id);
      toast.success("已删除");
      onDeleted();
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <div className="p-3">
      <div className="grid md:grid-cols-2 gap-3">
        {/* 左侧：图片展示区 */}
        <CharacterImageDisplay
          image={image}
          styleLabel={styleLabel}
          projectId={projectId}
          characterId={characterId}
          isPending={isPending}
          onPreview={onPreview}
          onSetPrimary={handleSetPrimary}
          onGenerate={handleGenerate}
          onDelete={handleDelete}
        />

        {/* 右侧：造型信息编辑 */}
        <CharacterStyleInfo
          label={styleLabel}
          imagePrompt={imagePrompt}
          saveStatus={saveStatus}
          onLabelChange={onLabelChange}
          onImagePromptChange={onImagePromptChange}
        />
      </div>
    </div>
  );
}
