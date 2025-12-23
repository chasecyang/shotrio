"use client";

import { useState, useRef, useEffect } from "react";
import { Episode } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { updateEpisode } from "@/lib/actions/project";
import { toast } from "sonner";
import {
  FileText,
  Zap,
  ScrollText,
} from "lucide-react";
import {
  EditableField,
  EditableInput,
  EditableTextarea,
  AIGenerationPanel,
  SaveStatus,
} from "@/components/ui/inline-editable-field";
import { optimizeEpisodeSummary, optimizeEpisodeHook, optimizeEpisodeScript } from "@/lib/actions/novel-actions";
import { useTranslations } from "next-intl";

interface EpisodeEditorProps {
  episode: Episode;
}

export function EpisodeEditor({ episode }: EpisodeEditorProps) {
  const t = useTranslations("editor.preview.episode");
  const [formData, setFormData] = useState({
    title: episode.title,
    summary: episode.summary || "",
    hook: episode.hook || "",
    scriptContent: episode.scriptContent || "",
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // AI 生成状态
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [isGeneratingHook, setIsGeneratingHook] = useState(false);
  const [generatedHook, setGeneratedHook] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 同步 episode 更新
  useEffect(() => {
    setFormData({
      title: episode.title,
      summary: episode.summary || "",
      hook: episode.hook || "",
      scriptContent: episode.scriptContent || "",
    });
  }, [episode]);

  // 自动保存
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const hasChanges =
      formData.title !== episode.title ||
      formData.summary !== (episode.summary || "") ||
      formData.hook !== (episode.hook || "") ||
      formData.scriptContent !== (episode.scriptContent || "");

    if (hasChanges) {
      setSaveStatus("idle");

      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          const result = await updateEpisode(episode.id, {
            title: formData.title || "未命名",
            summary: formData.summary || null,
            hook: formData.hook || null,
            scriptContent: formData.scriptContent || null,
          });

          if (result.success) {
            setSaveStatus("saved");
            if (savedTimeoutRef.current) {
              clearTimeout(savedTimeoutRef.current);
            }
            savedTimeoutRef.current = setTimeout(() => {
              setSaveStatus("idle");
            }, 3000);
          } else {
            setSaveStatus("error");
            toast.error(result.error || "保存失败");
          }
        } catch (error) {
          setSaveStatus("error");
          console.error(error);
        }
      }, 1500);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, episode]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  // AI 生成处理
  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    setGeneratedSummary(null);
    try {
      const result = await optimizeEpisodeSummary(
        formData.title,
        formData.hook,
        formData.scriptContent
      );
      if (result.success && result.summary) {
        setGeneratedSummary(result.summary);
        toast.success("AI 梗概生成成功");
      } else {
        toast.error(result.error || "生成失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("生成失败");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateHook = async () => {
    setIsGeneratingHook(true);
    setGeneratedHook(null);
    try {
      const result = await optimizeEpisodeHook(
        formData.title,
        formData.summary,
        formData.scriptContent
      );
      if (result.success && result.hook) {
        setGeneratedHook(result.hook);
        toast.success("AI 钩子生成成功");
      } else {
        toast.error(result.error || "生成失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("生成失败");
    } finally {
      setIsGeneratingHook(false);
    }
  };

  const handleGenerateScript = async () => {
    setIsGeneratingScript(true);
    setGeneratedScript(null);
    try {
      const result = await optimizeEpisodeScript(
        formData.title,
        formData.summary,
        formData.hook,
        formData.scriptContent
      );
      if (result.success && result.script) {
        setGeneratedScript(result.script);
        toast.success("AI 剧本生成成功");
      } else {
        toast.error(result.error || "生成失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("生成失败");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          {/* 标题栏 */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <Badge variant="outline" className="font-mono text-sm">
            第 {episode.order} 集
          </Badge>
          <div className="flex-1">
            <EditableInput
              value={formData.title}
              onChange={(value) => setFormData({ ...formData, title: value })}
              placeholder="输入剧集标题..."
              emptyText="未命名"
              className="text-xl font-semibold"
              inputClassName="text-xl font-semibold h-10"
            />
          </div>
        </div>

        {/* 梗概和钩子 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* 梗概 */}
          <div className="space-y-2">
            <EditableField
              label="梗概"
              icon={FileText}
              saveStatus={saveStatus}
              onAIGenerate={handleGenerateSummary}
              isAIGenerating={isGeneratingSummary}
              aiButtonTitle="AI 生成/优化梗概"
            >
              <EditableTextarea
                value={formData.summary}
                onChange={(value) => setFormData({ ...formData, summary: value })}
                placeholder="简要描述本集的主要内容..."
                emptyText="点击添加梗概"
                rows={4}
              />
            </EditableField>

            {generatedSummary && (
              <AIGenerationPanel
                content={generatedSummary}
                onAccept={() => {
                  setFormData({ ...formData, summary: generatedSummary });
                  setGeneratedSummary(null);
                }}
                onReject={() => setGeneratedSummary(null)}
              />
            )}
          </div>

          {/* 钩子 */}
          <div className="space-y-2">
            <EditableField
              label="钩子/亮点"
              icon={Zap}
              saveStatus={saveStatus}
              onAIGenerate={handleGenerateHook}
              isAIGenerating={isGeneratingHook}
              aiButtonTitle="AI 生成/优化钩子"
            >
              <EditableTextarea
                value={formData.hook}
                onChange={(value) => setFormData({ ...formData, hook: value })}
                placeholder="本集的核心冲突、悬念点或情感高潮..."
                emptyText="点击添加钩子/亮点"
                rows={4}
              />
            </EditableField>

            {generatedHook && (
              <AIGenerationPanel
                content={generatedHook}
                onAccept={() => {
                  setFormData({ ...formData, hook: generatedHook });
                  setGeneratedHook(null);
                }}
                onReject={() => setGeneratedHook(null)}
              />
            )}
          </div>
        </div>

        {/* 剧本内容 */}
        <div className="space-y-2">
          <EditableField
            label={t("script")}
            icon={ScrollText}
            saveStatus={saveStatus}
            onAIGenerate={handleGenerateScript}
            isAIGenerating={isGeneratingScript}
            aiButtonTitle={t("aiButtonTitle")}
          >
            <EditableTextarea
              value={formData.scriptContent}
              onChange={(value) => setFormData({ ...formData, scriptContent: value })}
              placeholder={t("scriptPlaceholder")}
              emptyText={t("scriptEmptyText")}
              textareaClassName="min-h-[300px] font-mono text-sm leading-relaxed"
              minHeight="min-h-[300px]"
            />
          </EditableField>

          {generatedScript && (
            <AIGenerationPanel
              content={
                <pre className="font-mono whitespace-pre-wrap max-h-[300px] overflow-auto bg-muted/50 p-3 rounded-md text-sm">
                  {generatedScript}
                </pre>
              }
              onAccept={() => {
                setFormData({ ...formData, scriptContent: generatedScript });
                setGeneratedScript(null);
              }}
              onReject={() => setGeneratedScript(null)}
            />
          )}
        </div>
        </div>
      </ScrollArea>
    </>
  );
}

