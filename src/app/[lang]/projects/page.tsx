"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { Film, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProject, getUserProjects } from "@/lib/actions/project";
import { toast } from "sonner";

export default function ProjectsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
  });

  // 检查用户是否有项目，如果有则自动跳转
  useEffect(() => {
    const checkProjects = async () => {
      try {
        const projects = await getUserProjects();
        if (projects && projects.length > 0) {
          // 有项目，跳转到第一个项目的编辑器
          router.push(`/projects/${projects[0].id}/editor`);
        } else {
          // 没有项目，显示空状态
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
        // 出错时也显示空状态，让用户可以创建项目
        setLoading(false);
      }
    };

    checkProjects();
  }, [router]);

  const handleCreateProject = async () => {
    if (!newProject.title.trim()) {
      toast.error("请输入项目名称");
      return;
    }

    setCreating(true);
    try {
      const result = await createProject({
        title: newProject.title,
        description: newProject.description || undefined,
      });

      if (result.success && result.data) {
        toast.success("项目创建成功");
        setDialogOpen(false);
        setNewProject({ title: "", description: "" });
        // 导航到新项目
        router.push(`/projects/${result.data.id}/editor`);
      } else {
        toast.error(result.error || "创建失败");
      }
    } catch (error) {
      toast.error("创建失败，请重试");
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 items-center justify-center p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-2xl w-full text-center space-y-8 px-4">
          {/* Icon */}
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
            <div className="relative w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/20">
              <Film className="w-12 h-12 text-primary-foreground" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span className="tracking-wide">准备开始创作</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold font-heading tracking-tight">
              欢迎使用 Cineqo
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              专业的微短剧创作工具，从剧本到成片，AI 助力每一步创作
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button 
              size="lg" 
              onClick={() => setDialogOpen(true)}
            >
              <Film className="mr-2 h-5 w-5" />
              创建第一个项目
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 text-sm">
            <div className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="font-semibold mb-1">智能剧本</div>
              <div className="text-muted-foreground text-xs">AI 辅助剧本创作和分镜设计</div>
            </div>
            <div className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="font-semibold mb-1">角色管理</div>
              <div className="text-muted-foreground text-xs">统一管理角色形象和风格</div>
            </div>
            <div className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="font-semibold mb-1">场景生成</div>
              <div className="text-muted-foreground text-xs">自动生成场景图片和视频</div>
            </div>
          </div>

          {/* Hint */}
          <p className="text-xs text-muted-foreground/60 pt-4">
            💡 提示：创建项目后，你可以通过顶部的项目切换器随时切换和创建新项目
          </p>
        </div>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">项目名称 *</Label>
              <Input
                id="title"
                placeholder="例如：霸道总裁爱上我"
                value={newProject.title}
                onChange={(e) =>
                  setNewProject({ ...newProject, title: e.target.value })
                }
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleCreateProject();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">项目简介</Label>
              <Textarea
                id="description"
                placeholder="简单描述这个项目..."
                value={newProject.description}
                onChange={(e) =>
                  setNewProject({ ...newProject, description: e.target.value })
                }
                disabled={creating}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              取消
            </Button>
            <Button onClick={handleCreateProject} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
