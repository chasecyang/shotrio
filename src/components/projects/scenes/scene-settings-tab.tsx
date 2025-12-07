"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { Scene } from "@/types/project";
import { upsertScene } from "@/lib/actions/scene";
import { toast } from "sonner";

interface SceneSettingsTabProps {
  projectId: string;
  scene: Scene;
  onSuccess?: () => void;
}

export function SceneSettingsTab({ projectId, scene, onSuccess }: SceneSettingsTabProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: scene.id,
    name: scene.name || "",
    description: scene.description || "",
    location: scene.location || "",
    timeOfDay: scene.timeOfDay || "",
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
        toast.success("保存成功");
        onSuccess?.();
      } else {
        toast.error(result.error || "保存失败");
      }
    } catch (error) {
      toast.error("保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">场景名称 *</Label>
        <Input
          id="name"
          placeholder="例如：咖啡厅、主角的家-客厅"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <p className="text-xs text-muted-foreground">
          用简洁的名称标识这个场景，便于后续选择使用
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">场景描述</Label>
        <Textarea
          id="description"
          placeholder="详细描述场景的氛围、环境特征、装饰风格、光线条件等..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          这个描述会作为 AI 生成场景图片的参考基础
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">位置标注</Label>
          <Input
            id="location"
            placeholder="如：内景、exterior、半室内"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            标注拍摄位置类型
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeOfDay">时间段</Label>
          <Input
            id="timeOfDay"
            placeholder="如：白天、黄昏、night"
            value={formData.timeOfDay}
            onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            场景的时间设定
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              保存设定
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
