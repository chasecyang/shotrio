"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Edit2,
  BookOpen
} from "lucide-react";
import { parseNovelFile, splitNovelByAIAsync, importNovelToProject } from "@/lib/actions/novel-actions";
import { getJobStatus } from "@/lib/actions/job";
import type { NovelEpisodeData } from "@/types/project";
import type { NovelSplitResult } from "@/types/job";
import { cn } from "@/lib/utils";
import { TaskProgressBar } from "@/components/tasks/task-progress-bar";

interface NovelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

type ImportStatus = "idle" | "uploading" | "parsing" | "splitting" | "preview" | "importing" | "success";

export function NovelImportDialog({ open, onOpenChange, projectId }: NovelImportDialogProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [episodes, setEpisodes] = useState<NovelEpisodeData[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setTextContent(""); // 清空文本内容
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextContent(e.target.value);
    setSelectedFile(null); // 清空文件选择
  };

  const handleProcess = async () => {
    let content = "";

    // 第一步：获取内容
    if (activeTab === "upload") {
      if (!selectedFile) {
        toast.error("请先选择文件");
        return;
      }

      setStatus("parsing");
      const result = await parseNovelFile(selectedFile);
      
      if (!result.success || !result.content) {
        toast.error(result.error || "文件解析失败");
        setStatus("idle");
        return;
      }

      content = result.content;
    } else {
      if (!textContent.trim()) {
        toast.error("请输入小说内容");
        return;
      }
      content = textContent.trim();
    }

    // 第二步：提交AI拆分任务
    setStatus("splitting");
    toast.info("已提交任务，AI正在分析并拆分小说...");

    const splitResult = await splitNovelByAIAsync(content, projectId, {
      maxEpisodes: 20,
    });

    if (!splitResult.success || !splitResult.jobId) {
      toast.error(splitResult.error || "提交任务失败");
      setStatus("idle");
      return;
    }

    // 开始轮询任务状态
    setJobId(splitResult.jobId);
    pollJobStatus(splitResult.jobId);
  };

  const pollJobStatus = async (jobId: string) => {
    const checkStatus = async () => {
      const result = await getJobStatus(jobId);
      
      if (!result.success || !result.job) {
        toast.error("获取任务状态失败");
        setStatus("idle");
        return;
      }

      const job = result.job;
      setJobProgress(job.progress);
      setJobMessage(job.progressMessage || "");

      if (job.status === "completed") {
        // 任务完成，解析结果
        if (job.resultData) {
          const resultData: NovelSplitResult = JSON.parse(job.resultData);
          
          // 获取已创建的剧集
          toast.success(`成功拆分为 ${resultData.episodeCount} 集`);
          router.refresh();
          
          // 关闭对话框
          setTimeout(() => {
            onOpenChange(false);
            resetDialog();
          }, 1500);
        }
      } else if (job.status === "failed") {
        toast.error(job.errorMessage || "任务失败");
        setStatus("idle");
        setJobId(null);
      } else if (job.status === "processing" || job.status === "pending") {
        // 继续轮询
        setTimeout(() => pollJobStatus(jobId), 2000);
      }
    };

    await checkStatus();
  };

  const handleImport = async () => {
    if (episodes.length === 0) {
      toast.error("没有可导入的剧集");
      return;
    }

    setStatus("importing");
    const result = await importNovelToProject(projectId, episodes);

    if (result.success) {
      setStatus("success");
      toast.success("导入成功！");
      // 刷新页面数据
      router.refresh();
      setTimeout(() => {
        onOpenChange(false);
        // 重置状态
        resetDialog();
      }, 1500);
    } else {
      toast.error(result.error || "导入失败");
      setStatus("preview");
    }
  };

  const resetDialog = () => {
    setStatus("idle");
    setSelectedFile(null);
    setTextContent("");
    setEpisodes([]);
    setActiveTab("upload");
    setJobId(null);
    setJobProgress(0);
    setJobMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && status !== "importing" && status !== "splitting" && status !== "parsing") {
      resetDialog();
    }
    onOpenChange(open);
  };

  const updateEpisode = (index: number, field: keyof NovelEpisodeData, value: string) => {
    const updated = [...episodes];
    updated[index] = { ...updated[index], [field]: value };
    setEpisodes(updated);
  };

  const isProcessing = status === "parsing" || status === "splitting" || status === "importing";
  const isPreview = status === "preview";
  const isSuccess = status === "success";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            导入小说并拆分剧集
          </DialogTitle>
          <DialogDescription>
            上传小说文件或粘贴文本，AI将自动拆分为微短剧剧集
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* 任务进度显示 */}
          {status === "splitting" && jobId && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 mb-4 animate-spin text-primary" />
                <h3 className="text-lg font-semibold mb-2">AI 正在处理中...</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {jobMessage || "正在拆分小说内容"}
                </p>
                <div className="w-full max-w-md">
                  <TaskProgressBar
                    progress={jobProgress}
                    status="processing"
                    showPercentage={true}
                  />
                </div>
              </div>
            </div>
          )}

          {!isPreview && !isSuccess && !jobId && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "paste")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" disabled={isProcessing}>
                  <Upload className="w-4 h-4 mr-2" />
                  上传文件
                </TabsTrigger>
                <TabsTrigger value="paste" disabled={isProcessing}>
                  <FileText className="w-4 h-4 mr-2" />
                  粘贴文本
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>选择文件</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.pdf,.docx"
                      onChange={handleFileSelect}
                      disabled={isProcessing}
                      className="flex-1"
                    />
                  </div>
                  {selectedFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span>{selectedFile.name}</span>
                      <span className="text-xs">
                        ({(selectedFile.size / 1024).toFixed(2)} KB)
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    支持 .txt、.pdf、.docx 格式
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>小说内容</Label>
                  <Textarea
                    value={textContent}
                    onChange={handleTextChange}
                    placeholder="粘贴或输入小说内容..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={isProcessing}
                  />
                  {textContent && (
                    <p className="text-xs text-muted-foreground">
                      已输入 {textContent.length} 字
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {isPreview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">预览拆分结果</h3>
                  <p className="text-sm text-muted-foreground">
                    共 {episodes.length} 集，可以编辑后导入
                  </p>
                </div>
              </div>

              <Accordion type="single" collapsible className="space-y-2">
                {episodes.map((ep, index) => (
                  <AccordionItem 
                    key={index} 
                    value={`episode-${index}`}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                          第 {ep.order} 集
                        </span>
                        <span className="font-medium">{ep.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-3">
                      <div className="space-y-2">
                        <Label className="text-xs">标题</Label>
                        <Input
                          value={ep.title}
                          onChange={(e) => updateEpisode(index, "title", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">梗概</Label>
                        <Textarea
                          value={ep.summary}
                          onChange={(e) => updateEpisode(index, "summary", e.target.value)}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">钩子/亮点</Label>
                        <Textarea
                          value={ep.hook}
                          onChange={(e) => updateEpisode(index, "hook", e.target.value)}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">剧本内容</Label>
                        <Textarea
                          value={ep.scriptContent}
                          onChange={(e) => updateEpisode(index, "scriptContent", e.target.value)}
                          rows={8}
                          className="text-sm font-mono resize-none"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          {isSuccess && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">导入成功！</h3>
              <p className="text-sm text-muted-foreground">
                已成功导入 {episodes.length} 集剧本
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!isPreview && !isSuccess && !jobId && (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isProcessing}
              >
                取消
              </Button>
              <Button
                onClick={handleProcess}
                disabled={isProcessing || (!selectedFile && !textContent)}
              >
                {status === "parsing" && (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    解析中...
                  </>
                )}
                {status === "idle" && "开始处理"}
              </Button>
            </>
          )}

          {jobId && status === "splitting" && (
            <Button
              variant="outline"
              onClick={() => {
                toast.info("任务将在后台继续运行，您可以在后台任务查看进度");
                onOpenChange(false);
                resetDialog();
              }}
            >
              后台运行
            </Button>
          )}

          {isPreview && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStatus("idle");
                  setEpisodes([]);
                }}
              >
                重新处理
              </Button>
              <Button onClick={handleImport}>
                确认导入 {episodes.length} 集
              </Button>
            </>
          )}

          {isSuccess && (
            <Button onClick={() => handleOpenChange(false)}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

