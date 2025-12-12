"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { upsertScene } from "@/lib/actions/scene";
import { toast } from "sonner";

interface SceneDialogProps {
  projectId: string;
  trigger?: React.ReactNode;
}

export function SceneDialog({ projectId, trigger }: SceneDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("请输入场景名称");
      return;
    }

    setLoading(true);
    try {
      const result = await upsertScene(projectId, formData);
      if (result.success) {
        toast.success("场景创建成功");
        setOpen(false);
        setFormData({ name: "", description: "" });
      } else {
        toast.error(result.error || "创建失败");
      }
    } catch {
      toast.error("创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            创建场景
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>创建场景</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">场景名称 *</Label>
            <Input
              id="name"
              placeholder="例如：咖啡厅、主角的家-客厅"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">场景描述</Label>
            <Textarea
              id="description"
              placeholder="详细描述场景的氛围、环境特征、装饰风格、光线条件等，这将作为 AI 生成场景图片的基础..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              提示：可以包含时间（白天/夜晚）、位置（内景/外景）、氛围等信息
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              创建
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
