"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Clock, FileText, Building } from "lucide-react";
import { Scene } from "@/types/project";
import { upsertScene } from "@/lib/actions/scene";
import { toast } from "sonner";
import { 
  EditableField, 
  EditableInput, 
  EditableTextarea,
  SaveStatus
} from "@/components/ui/inline-editable-field";

interface SceneSettingsTabProps {
  projectId: string;
  scene: Scene;
  onSuccess?: () => void;
}

export function SceneSettingsTab({ projectId, scene, onSuccess }: SceneSettingsTabProps) {
  const [formData, setFormData] = useState({
    id: scene.id,
    name: scene.name || "",
    description: scene.description || "",
    location: scene.location || "",
    timeOfDay: scene.timeOfDay || "",
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 自动保存逻辑
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const hasChanges =
      formData.name !== (scene.name || "") ||
      formData.description !== (scene.description || "") ||
      formData.location !== (scene.location || "") ||
      formData.timeOfDay !== (scene.timeOfDay || "");

    if (hasChanges && formData.name.trim()) {
      setSaveStatus("idle");

      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          const result = await upsertScene(projectId, formData);

          if (result.success) {
            setSaveStatus("saved");
            onSuccess?.();

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
          toast.error("保存失败");
        }
      }, 1500);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, scene, projectId, onSuccess]);

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

  return (
    <div className="space-y-4">
      <EditableField
        label="场景名称"
        icon={Building}
        tooltip="用简洁的名称标识这个场景，便于后续选择使用"
        saveStatus={saveStatus}
      >
        <EditableInput
          value={formData.name}
          onChange={(value) => setFormData({ ...formData, name: value })}
          placeholder="例如：咖啡厅、主角的家-客厅"
          emptyText="点击输入场景名称"
        />
      </EditableField>

      <EditableField
        label="场景描述"
        icon={FileText}
        tooltip="详细描述场景的氛围、环境特征、装饰风格、光线条件等，这个描述会作为 AI 生成场景图片的参考基础"
        saveStatus={saveStatus}
      >
        <EditableTextarea
          value={formData.description}
          onChange={(value) => setFormData({ ...formData, description: value })}
          placeholder="详细描述场景的氛围、环境特征、装饰风格、光线条件等..."
          emptyText="点击输入场景描述"
          rows={4}
          minHeight="min-h-[100px]"
        />
      </EditableField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EditableField
          label="位置标注"
          icon={MapPin}
          tooltip="标注拍摄位置类型，如内景、外景等"
          saveStatus={saveStatus}
        >
          <EditableInput
            value={formData.location}
            onChange={(value) => setFormData({ ...formData, location: value })}
            placeholder="如：内景、exterior、半室内"
            emptyText="点击输入位置标注"
          />
        </EditableField>

        <EditableField
          label="时间段"
          icon={Clock}
          tooltip="场景的时间设定"
          saveStatus={saveStatus}
        >
          <EditableInput
            value={formData.timeOfDay}
            onChange={(value) => setFormData({ ...formData, timeOfDay: value })}
            placeholder="如：白天、黄昏、night"
            emptyText="点击输入时间段"
          />
        </EditableField>
      </div>
    </div>
  );
}
