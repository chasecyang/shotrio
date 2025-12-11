"use client";

import { useState } from "react";
import { Scene, SceneImage } from "@/types/project";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { deleteScene } from "@/lib/actions/scene";
import { SceneCardHeader } from "./scene-card-header";
import { SceneBasicInfoTab } from "./scene-basic-info-tab";
import { SceneMasterLayoutTab } from "./scene-master-layout-tab";
import { SceneQuarterViewTab } from "./scene-quarter-view-tab";
import { useAutoSave } from "@/hooks/use-auto-save";
import { ChipNav, ChipNavItem } from "../characters/chip-nav";
import { Film, Camera, FileText } from "lucide-react";

interface SceneCardProps {
  scene: Scene & { images: SceneImage[] };
  projectId: string;
  isHighlighted?: boolean;
}

interface FormData {
  name: string;
  description: string;
}

export function SceneCard({ 
  scene, 
  projectId,
  isHighlighted = false,
}: SceneCardProps) {
  const [activeTab, setActiveTab] = useState("basic-info");
  
  const [formData, setFormData] = useState<FormData>({
    name: scene.name,
    description: scene.description || "",
  });

  const masterLayout = scene.images?.find(img => img.imageType === "master_layout");
  const quarterView = scene.images?.find(img => img.imageType === "quarter_view");
  const hasDescription = !!formData.description;
  
  // 计算完成度
  const completionPercentage = hasDescription 
    ? (masterLayout && quarterView ? 100 : masterLayout ? 50 : 0)
    : 0;

  const { saveStatus } = useAutoSave({
    data: formData,
    originalData: {
      name: scene.name,
      description: scene.description || "",
    },
    onSave: async (data) => {
      const { upsertScene } = await import("@/lib/actions/scene");
      return await upsertScene(projectId, {
        id: scene.id,
        name: data.name,
        description: data.description || undefined,
      });
    },
  });

  const handleDelete = async () => {
    if (confirm(`确定要删除场景「${scene.name}」吗？`)) {
      try {
        await deleteScene(projectId, scene.id);
        toast.success("场景已删除");
      } catch {
        toast.error("删除失败");
      }
    }
  };

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-300 bg-card hover:border-primary/40 rounded-lg shadow-none",
        isHighlighted && "animate-in fade-in zoom-in duration-500 border-primary ring-1 ring-primary/40"
      )}
    >
      <SceneCardHeader
        name={formData.name}
        onNameChange={(name) => setFormData({ ...formData, name })}
        masterLayout={masterLayout}
        quarterView={quarterView}
        hasDescription={hasDescription}
        completionPercentage={completionPercentage}
        saveStatus={saveStatus}
        onDelete={handleDelete}
        isHighlighted={isHighlighted}
      />

      <div className="px-3 py-1.5 sm:px-4 sm:py-2">
        <ChipNav>
          <ChipNavItem 
            active={activeTab === "basic-info"}
            onClick={() => setActiveTab("basic-info")}
          >
            <FileText className="w-3 h-3" />
            基础信息
          </ChipNavItem>
          
          <ChipNavItem 
            active={activeTab === "master-layout"}
            onClick={() => setActiveTab("master-layout")}
          >
            <Film className="w-3 h-3" />
            全景布局
            {masterLayout && (
              <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full" />
            )}
          </ChipNavItem>
          
          <ChipNavItem 
            active={activeTab === "quarter-view"}
            onClick={() => setActiveTab("quarter-view")}
          >
            <Camera className="w-3 h-3" />
            叙事视角
            {quarterView && (
              <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full" />
            )}
          </ChipNavItem>
        </ChipNav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === "basic-info" && (
          <SceneBasicInfoTab
            description={formData.description}
            onDescriptionChange={(value) => setFormData({ ...formData, description: value })}
          />
        )}

        {activeTab === "master-layout" && (
          <SceneMasterLayoutTab
            projectId={projectId}
            scene={scene}
            masterLayout={masterLayout}
          />
        )}

        {activeTab === "quarter-view" && (
          <SceneQuarterViewTab
            projectId={projectId}
            scene={scene}
            masterLayout={masterLayout}
            quarterView={quarterView}
          />
        )}
      </div>
    </Card>
  );
}

