"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectDetail, Episode } from "@/types/project";
import { updateEpisode, deleteEpisode, createEpisode } from "@/lib/actions/project";
import { optimizeEpisodeSummary, optimizeEpisodeHook, optimizeEpisodeScript } from "@/lib/actions/novel-actions";
import { toast } from "sonner";
import { 
  Trash2, 
  Film,
  Loader2,
  BookOpen,
  Plus,
  FileText,
  Zap,
  ScrollText,
  Users,
  Sparkles
} from "lucide-react";
import { 
  EditableField, 
  EditableInput, 
  EditableTextarea, 
  AIGenerationPanel,
  SaveStatus 
} from "@/components/ui/inline-editable-field";
import { NovelImportDialog } from "./novel-import-dialog";
import { CharacterExtractionBanner } from "../characters/character-extraction-banner";
import { CharacterExtractionDialog } from "../characters/character-extraction-dialog";
import { startCharacterExtraction } from "@/lib/actions/character";
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

interface ScriptsSectionProps {
  project: ProjectDetail;
}

export function ScriptsSection({ project }: ScriptsSectionProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewJobId, setPreviewJobId] = useState<string>("");
  const [isStartingExtraction, setIsStartingExtraction] = useState(false);
  const [recentlyImportedJobId, setRecentlyImportedJobId] = useState<string | null>(null);
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  // 处理点击"从剧本提取"按钮
  const handleStartExtraction = async () => {
    setIsStartingExtraction(true);
    try {
      const result = await startCharacterExtraction(project.id);
      
      if (result.success) {
        toast.success("已提交角色提取任务");
      } else {
        toast.error(result.error || "提交任务失败");
      }
    } catch (error) {
      toast.error("提交任务失败");
      console.error("启动角色提取失败:", error);
    } finally {
      setIsStartingExtraction(false);
    }
  };

  // 处理打开预览对话框
  const handleOpenPreview = (jobId: string) => {
    setPreviewJobId(jobId);
    setPreviewDialogOpen(true);
  };

  const handleImportSuccess = () => {
    if (previewJobId) {
      setRecentlyImportedJobId(previewJobId);
    }
    router.refresh();
  };

  const handleCreateEpisode = async () => {
    setIsCreating(true);
    try {
      const result = await createEpisode({
        projectId: project.id,
        title: `第 ${project.episodes.length + 1} 集`,
        order: project.episodes.length + 1,
      });

      if (result.success) {
        toast.success("创建成功");
        router.refresh();
      } else {
        toast.error(result.error || "创建失败");
      }
    } catch (error) {
      toast.error("创建失败，请重试");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {project.episodes.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Film className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">还没有剧集</h3>
          <p className="text-muted-foreground mb-6">
            可以从小说导入并自动拆分剧集，或者手动创建剧集
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => setImportDialogOpen(true)}>
              <BookOpen className="w-4 h-4 mr-2" />
              导入小说
            </Button>
            <Button variant="outline" onClick={handleCreateEpisode} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              新建剧集
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button 
              onClick={handleStartExtraction} 
              variant="outline"
              disabled={isStartingExtraction}
              className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20 hover:border-primary/40"
            >
              {isStartingExtraction ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  <Users className="w-4 h-4 mr-1" />
                </>
              )}
              提取角色
            </Button>
            <Button onClick={() => setImportDialogOpen(true)} variant="outline">
              <BookOpen className="w-4 h-4 mr-2" />
              导入小说
            </Button>
            <Button onClick={handleCreateEpisode} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              新建剧集
            </Button>
          </div>
          
          {/* 角色提取横幅 */}
          <CharacterExtractionBanner
            projectId={project.id}
            onOpenPreview={handleOpenPreview}
            recentlyImportedJobId={recentlyImportedJobId}
          />
          <div className="space-y-3">
            {project.episodes.map((episode) => (
              <EpisodeRow key={episode.id} episode={episode} />
            ))}
          </div>
        </div>
      )}
      
      <NovelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        projectId={project.id}
      />

      {/* 预览和导入对话框 */}
      {previewJobId && (
        <CharacterExtractionDialog
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          projectId={project.id}
          jobId={previewJobId}
          existingCharacters={project.characters.map(c => ({ id: c.id, name: c.name }))}
          onImportSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}

interface EpisodeRowProps {
  episode: Episode;
}

function EpisodeRow({ episode }: EpisodeRowProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: episode.title,
    summary: episode.summary || "",
    hook: episode.hook || "",
    scriptContent: episode.scriptContent || "",
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // AI 相关状态
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);

  const [isGeneratingHook, setIsGeneratingHook] = useState(false);
  const [generatedHook, setGeneratedHook] = useState<string | null>(null);

  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 自动保存逻辑
  useEffect(() => {
    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 检查是否有更改
    const hasChanges =
      formData.title !== episode.title ||
      formData.summary !== (episode.summary || "") ||
      formData.hook !== (episode.hook || "") ||
      formData.scriptContent !== (episode.scriptContent || "");

    if (hasChanges) {
      setSaveStatus("idle");
      
      // 1.5秒后自动保存
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
            
            // 3秒后隐藏"已保存"状态
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

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteEpisode(episode.id);
      if (result.success) {
        toast.success("删除成功");
        setDeleteDialogOpen(false);
        // 刷新页面数据
        router.refresh();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      toast.error("删除失败，请重试");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

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
      toast.error("生成失败，请重试");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleAcceptSummary = () => {
    if (generatedSummary) {
      setFormData(prev => ({ ...prev, summary: generatedSummary }));
      setGeneratedSummary(null);
    }
  };

  const handleRejectSummary = () => {
    setGeneratedSummary(null);
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
      toast.error("生成失败，请重试");
    } finally {
      setIsGeneratingHook(false);
    }
  };

  const handleAcceptHook = () => {
    if (generatedHook) {
      setFormData(prev => ({ ...prev, hook: generatedHook }));
      setGeneratedHook(null);
    }
  };

  const handleRejectHook = () => {
    setGeneratedHook(null);
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
      toast.error("生成失败，请重试");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleAcceptScript = () => {
    if (generatedScript) {
      setFormData(prev => ({ ...prev, scriptContent: generatedScript }));
      setGeneratedScript(null);
    }
  };

  const handleRejectScript = () => {
    setGeneratedScript(null);
  };

  return (
    <>
      <div className="border rounded-lg bg-card hover:border-primary/40 transition-all">
        {/* 剧集标题栏 */}
        <div className="p-3 border-b bg-muted/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Badge variant="outline" className="font-mono flex-shrink-0 text-xs">
                第 {episode.order} 集
              </Badge>
              <div className="flex-1 min-w-0">
                <EditableInput
                  value={formData.title}
                  onChange={(value) => setFormData({ ...formData, title: value })}
                  placeholder="输入剧集标题..."
                  emptyText="未命名"
                  className="px-2 py-1 -mx-2 -my-1"
                  inputClassName="h-8 text-sm font-medium"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive hover:text-destructive h-7 w-7 p-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-3 space-y-3">
          {/* 梗概和钩子 - 在宽屏下并排显示 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* 梗概 */}
            <div className="space-y-1.5">
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
                  rows={3}
                />
              </EditableField>

              {/* AI 生成结果预览区 */}
              {generatedSummary && (
                <AIGenerationPanel
                  content={generatedSummary}
                  onAccept={handleAcceptSummary}
                  onReject={handleRejectSummary}
                />
              )}
            </div>

            {/* 钩子/亮点 */}
            <div className="space-y-1.5">
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
                  rows={3}
                />
              </EditableField>

              {/* AI 生成结果预览区 */}
              {generatedHook && (
                <AIGenerationPanel
                  content={generatedHook}
                  onAccept={handleAcceptHook}
                  onReject={handleRejectHook}
                />
              )}
            </div>
          </div>

          {/* 剧本内容 - 全宽显示 */}
          <div className="space-y-1.5">
            <EditableField
              label="剧本内容"
              icon={ScrollText}
              saveStatus={saveStatus}
              onAIGenerate={handleGenerateScript}
              isAIGenerating={isGeneratingScript}
              aiButtonTitle="AI 生成/优化剧本"
            >
              <EditableTextarea
                value={formData.scriptContent}
                onChange={(value) => setFormData({ ...formData, scriptContent: value })}
                placeholder="编写完整的剧本内容，包括场景描述、人物对话、动作等..."
                emptyText="点击编写剧本内容"
                textareaClassName="min-h-[180px] font-mono text-xs leading-relaxed"
                minHeight="min-h-[180px]"
                className="max-h-[280px] overflow-auto"
              />
            </EditableField>

            {/* AI 生成结果预览区 */}
            {generatedScript && (
              <AIGenerationPanel
                content={
                  <pre className="font-mono whitespace-pre-wrap max-h-[280px] overflow-auto bg-white/50 p-2 rounded">
                    {generatedScript}
                  </pre>
                }
                onAccept={handleAcceptScript}
                onReject={handleRejectScript}
              />
            )}
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{episode.title}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

