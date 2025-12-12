"use client";

import { useState, useEffect, useRef } from "react";
import { ShotDialogue, Character, EmotionTag } from "@/types/project";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { updateShotDialogue, deleteShotDialogue } from "@/lib/actions/project";
import { toast } from "sonner";
import { Trash2, Volume2, User } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DialogueEditorProps {
  dialogue: ShotDialogue & { character?: Character | null };
  characters: Character[];
  onUpdate: () => void;
  isDragging?: boolean;
}

const EMOTION_OPTIONS: { value: EmotionTag; label: string; emoji: string }[] = [
  { value: "neutral", label: "平静", emoji: "😐" },
  { value: "happy", label: "开心", emoji: "😊" },
  { value: "sad", label: "悲伤", emoji: "😢" },
  { value: "angry", label: "愤怒", emoji: "😠" },
  { value: "surprised", label: "惊讶", emoji: "😲" },
  { value: "fearful", label: "恐惧", emoji: "😨" },
  { value: "disgusted", label: "厌恶", emoji: "🤢" },
];

// 使用特殊值来代表旁白，因为 Select 不允许空字符串
const NARRATOR_VALUE = "__NARRATOR__";

export function DialogueEditor({ dialogue, characters, onUpdate, isDragging }: DialogueEditorProps) {
  const [text, setText] = useState(dialogue.dialogueText);
  const [characterId, setCharacterId] = useState<string>(dialogue.characterId || NARRATOR_VALUE);
  const [emotion, setEmotion] = useState<EmotionTag>(
    (dialogue.emotionTag as EmotionTag) || "neutral"
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 自动保存逻辑
  useEffect(() => {
    const currentCharId = dialogue.characterId || NARRATOR_VALUE;
    const hasChanges =
      text !== dialogue.dialogueText ||
      characterId !== currentCharId ||
      emotion !== (dialogue.emotionTag || "neutral");

    if (hasChanges) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const result = await updateShotDialogue(dialogue.id, {
            dialogueText: text,
            characterId: characterId === NARRATOR_VALUE ? null : characterId,
            emotionTag: emotion,
          });

          if (result.success) {
            onUpdate();
          } else {
            toast.error(result.error || "保存失败");
          }
        } catch (error) {
          console.error(error);
          toast.error("保存失败");
        }
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [text, characterId, emotion, dialogue, onUpdate]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteShotDialogue(dialogue.id);
      if (result.success) {
        toast.success("对话已删除");
        setDeleteDialogOpen(false);
        onUpdate();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const emotionOption = EMOTION_OPTIONS.find((e) => e.value === emotion);

  return (
    <>
      <div
        className={`
          group relative rounded-lg border p-3 space-y-2 transition-all
          ${isDragging ? "opacity-50" : ""}
          ${isEditing ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}
        `}
      >
        {/* 序号和操作按钮 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
              {dialogue.order}
            </Badge>

            {/* 说话人选择 */}
            <Select value={characterId} onValueChange={setCharacterId}>
              <SelectTrigger className="h-6 text-xs border-transparent bg-transparent hover:bg-background hover:border-input px-2 w-auto min-w-[80px] max-w-[150px]">
                <User className="w-3 h-3 mr-1" />
                <SelectValue placeholder="旁白" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NARRATOR_VALUE}>旁白</SelectItem>
                {characters.map((char) => (
                  <SelectItem key={char.id} value={char.id}>
                    {char.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 情绪标签 */}
            <Select value={emotion} onValueChange={(v) => setEmotion(v as EmotionTag)}>
              <SelectTrigger className="h-6 text-xs border-transparent bg-transparent hover:bg-background hover:border-input px-2 w-auto min-w-[70px]">
                <span className="mr-1">{emotionOption?.emoji}</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMOTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <span>{option.emoji}</span>
                      <span>{option.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {dialogue.audioUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => {
                  // TODO: 播放音频
                  toast.info("音频播放功能开发中");
                }}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 对话内容 */}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          placeholder="输入对话内容..."
          className="min-h-[60px] text-sm resize-none border-transparent bg-transparent hover:bg-background hover:border-input focus:bg-background focus:border-input transition-colors"
          rows={2}
        />
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除这条对话吗？此操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

