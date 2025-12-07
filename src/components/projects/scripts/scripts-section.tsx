"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ProjectDetail, Episode } from "@/types/project";
import { updateEpisode, deleteEpisode, createEpisode } from "@/lib/actions/project";
import { optimizeEpisodeSummary, optimizeEpisodeHook, optimizeEpisodeScript } from "@/lib/actions/novel-actions";
import { toast } from "sonner";
import { 
  Trash2, 
  Film,
  Loader2,
  Check,
  AlertCircle,
  Edit2,
  BookOpen,
  Plus,
  Sparkles,
  X,
  FileText,
  Zap,
  ScrollText,
  Users
} from "lucide-react";
import { NovelImportDialog } from "./novel-import-dialog";
import { CharacterExtractionDialog } from "../characters/character-extraction-dialog";
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
import { cn } from "@/lib/utils";

interface ScriptsSectionProps {
  project: ProjectDetail;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ScriptsSection({ project }: ScriptsSectionProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

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
              onClick={() => setExtractionDialogOpen(true)} 
              variant="outline"
              className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20 hover:border-primary/40"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              <Users className="w-4 h-4 mr-1" />
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

      <CharacterExtractionDialog
        open={extractionDialogOpen}
        onOpenChange={setExtractionDialogOpen}
        projectId={project.id}
        existingCharacters={project.characters.map(c => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}

interface EpisodeRowProps {
  episode: Episode;
}

function EpisodeRow({ episode }: EpisodeRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
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

    if (hasChanges && isEditing) {
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
  }, [formData, episode, isEditing]);

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

  const handleFieldClick = (field: string) => {
    setIsEditing(true);
    setEditingField(field);
  };

  const handleGenerateSummary = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发 handleFieldClick
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
      setIsEditing(true); // 确保触发保存逻辑
      setGeneratedSummary(null);
    }
  };

  const handleRejectSummary = () => {
    setGeneratedSummary(null);
  };

  const handleGenerateHook = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      setIsEditing(true);
      setGeneratedHook(null);
    }
  };

  const handleRejectHook = () => {
    setGeneratedHook(null);
  };

  const handleGenerateScript = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      setIsEditing(true);
      setGeneratedScript(null);
    }
  };

  const handleRejectScript = () => {
    setGeneratedScript(null);
  };

  return (
    <>
      <div className="border rounded-lg bg-card hover:shadow-sm transition-shadow">
        {/* 剧集标题栏 */}
        <div className="p-3 border-b bg-muted/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Badge variant="outline" className="font-mono flex-shrink-0 text-xs">
                第 {episode.order} 集
              </Badge>
              <div 
                className="flex-1 min-w-0 cursor-pointer group"
                onClick={() => handleFieldClick('title')}
              >
                {isEditing && editingField === 'title' ? (
                  <Input
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="输入剧集标题..."
                    className="h-8 text-sm font-medium"
                    autoFocus
                    onBlur={() => setEditingField(null)}
                  />
                ) : (
                  <div className="flex items-center gap-2 px-2 py-1 -mx-2 -my-1 rounded group-hover:bg-muted/50 transition-all">
                    <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {formData.title || "未命名"}
                    </h3>
                    <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <SaveStatusIndicator status={saveStatus} />
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
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-1.5 cursor-pointer group"
                  onClick={() => handleFieldClick('summary')}
                >
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs font-semibold text-foreground cursor-pointer">梗概</Label>
                  <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary}
                  title="AI 生成/优化梗概"
                >
                  {isGeneratingSummary ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
              
              <div 
                className="cursor-pointer group"
                onClick={() => handleFieldClick('summary')}
              >
                {isEditing && editingField === 'summary' ? (
                  <Textarea
                    value={formData.summary}
                    onChange={(e) =>
                      setFormData({ ...formData, summary: e.target.value })
                    }
                    placeholder="简要描述本集的主要内容..."
                    rows={3}
                    className="text-sm resize-none"
                    autoFocus
                    onBlur={() => setEditingField(null)}
                  />
                ) : (
                  <div className={cn(
                    "px-2.5 py-2 rounded-md border border-transparent group-hover:border-muted group-hover:bg-muted/30 transition-all",
                    !formData.summary && "py-1.5"
                  )}>
                    <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {formData.summary || (
                        <span className="text-xs text-muted-foreground/60 italic">点击添加梗概</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* AI 生成结果预览区 */}
              {generatedSummary && (
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
                        onClick={handleAcceptSummary}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        接受
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-muted-foreground hover:text-foreground"
                        onClick={handleRejectSummary}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        拒绝
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80">{generatedSummary}</p>
                </div>
              )}
            </div>

            {/* 钩子/亮点 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-1.5 cursor-pointer group"
                  onClick={() => handleFieldClick('hook')}
                >
                  <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs font-semibold text-foreground cursor-pointer">钩子/亮点</Label>
                  <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  onClick={handleGenerateHook}
                  disabled={isGeneratingHook}
                  title="AI 生成/优化钩子"
                >
                  {isGeneratingHook ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
              
              <div 
                className="cursor-pointer group"
                onClick={() => handleFieldClick('hook')}
              >
                {isEditing && editingField === 'hook' ? (
                  <Textarea
                    value={formData.hook}
                    onChange={(e) =>
                      setFormData({ ...formData, hook: e.target.value })
                    }
                    placeholder="本集的核心冲突、悬念点或情感高潮..."
                    rows={3}
                    className="text-sm resize-none"
                    autoFocus
                    onBlur={() => setEditingField(null)}
                  />
                ) : (
                  <div className={cn(
                    "px-2.5 py-2 rounded-md border border-transparent group-hover:border-muted group-hover:bg-muted/30 transition-all",
                    !formData.hook && "py-1.5"
                  )}>
                    <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {formData.hook || (
                        <span className="text-xs text-muted-foreground/60 italic">点击添加钩子/亮点</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* AI 生成结果预览区 */}
              {generatedHook && (
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
                        onClick={handleAcceptHook}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        接受
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-muted-foreground hover:text-foreground"
                        onClick={handleRejectHook}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        拒绝
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80">{generatedHook}</p>
                </div>
              )}
            </div>
          </div>

          {/* 剧本内容 - 全宽显示 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center gap-1.5 cursor-pointer group"
                onClick={() => handleFieldClick('scriptContent')}
              >
                <ScrollText className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold text-foreground cursor-pointer">剧本内容</Label>
                <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                onClick={handleGenerateScript}
                disabled={isGeneratingScript}
                title="AI 生成/优化剧本"
              >
                {isGeneratingScript ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
            
            <div 
              className="cursor-pointer group"
              onClick={() => handleFieldClick('scriptContent')}
            >
              {isEditing && editingField === 'scriptContent' ? (
                <Textarea
                  value={formData.scriptContent}
                  onChange={(e) =>
                    setFormData({ ...formData, scriptContent: e.target.value })
                  }
                  placeholder="编写完整的剧本内容，包括场景描述、人物对话、动作等..."
                  className="min-h-[180px] font-mono text-xs leading-relaxed"
                  autoFocus
                  onBlur={() => setEditingField(null)}
                />
              ) : (
                <div className={cn(
                  "px-2.5 py-2 rounded-md border border-transparent group-hover:border-muted group-hover:bg-muted/30 transition-all max-h-[280px] overflow-auto",
                  formData.scriptContent ? "min-h-[180px]" : "py-1.5"
                )}>
                  <div className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    {formData.scriptContent ? (
                      <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                        {formData.scriptContent}
                      </pre>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">点击编写剧本内容</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI 生成结果预览区 */}
            {generatedScript && (
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
                      onClick={handleAcceptScript}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      接受
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-muted-foreground hover:text-foreground"
                      onClick={handleRejectScript}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      拒绝
                    </Button>
                  </div>
                </div>
                <pre className="text-sm text-foreground/80 font-mono whitespace-pre-wrap max-h-[280px] overflow-auto bg-white/50 p-2 rounded">
                  {generatedScript}
                </pre>
              </div>
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

interface SaveStatusIndicatorProps {
  status: SaveStatus;
}

function SaveStatusIndicator({ status }: SaveStatusIndicatorProps) {
  if (status === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm transition-opacity",
        status === "saved" && "animate-in fade-in"
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">保存中...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-green-600">已保存</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-destructive">保存失败</span>
        </>
      )}
    </div>
  );
}
