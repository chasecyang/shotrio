"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Character, CharacterImage } from "@/types/project";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { StyleSidebar } from "./style-sidebar";
import { StyleDetailPanel } from "./style-detail-panel";
import { createCharacterStyle } from "@/lib/actions/character";
import { toast } from "sonner";

interface StylesManagerProps {
  projectId: string;
  character: Character & { images: CharacterImage[] };
  hasBasicInfo: boolean;
  jobs: Partial<{
    type?: string;
    status?: string;
    inputData?: string;
    projectId?: string;
    progress?: number;
    progressMessage?: string;
  }>[];
  onPreview: (image: CharacterImage) => void;
}

/**
 * 造型管理器组件 - 新的侧边栏布局
 * 
 * 功能：
 * - 左侧：造型侧边栏列表（带缩略图）
 * - 右侧：当前选中造型的详情面板
 * - 处理造型创建逻辑
 * - 修复 render 中调用 setState 的 bug
 */
export function StylesManager({
  projectId,
  character,
  hasBasicInfo,
  jobs,
  onPreview,
}: StylesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeStyleId, setActiveStyleId] = useState<string | null>(
    character.images[0]?.id || null
  );
  const [isCreatingStyle, setIsCreatingStyle] = useState(false);

  // 修复 bug：使用 useEffect 而不是在 render 中调用 setState
  useEffect(() => {
    if (!activeStyleId && character.images.length > 0) {
      setActiveStyleId(character.images[0].id);
    }
  }, [character.images, activeStyleId]);

  const handleCreateStyle = async () => {
    if (!hasBasicInfo) {
      toast.error("请先完善角色的外貌描述");
      return;
    }

    setIsCreatingStyle(true);
    try {
      // 生成默认名称
      const styleCount = character.images.length + 1;
      const defaultLabel = `造型 ${styleCount}`;
      const defaultPrompt = `角色的第 ${styleCount} 个造型`;

      console.log("📝 开始创建造型...");
      const result = await createCharacterStyle(projectId, character.id, {
        label: defaultLabel,
        stylePrompt: defaultPrompt,
      });

      console.log("📥 创建结果:", result);

      if (result.success && result.imageId) {
        console.log("✅ 创建成功，准备刷新页面");
        toast.success("造型已创建");
        setActiveStyleId(result.imageId);
        // 使用 startTransition 包装 router.refresh，确保状态更新正确
        startTransition(() => {
          console.log("🔄 开始刷新页面...");
          router.refresh();
        });
        setIsCreatingStyle(false);
        console.log("🎉 状态已重置");
      } else {
        toast.error(result.error || "创建失败");
        setIsCreatingStyle(false);
      }
    } catch (error) {
      toast.error("创建失败");
      console.error(error);
      setIsCreatingStyle(false);
    }
  };

  // 如果没有造型，显示空状态
  if (character.images.length === 0) {
    return (
      <div className="p-6">
        <Alert className="border-dashed">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            还没有造型。{!hasBasicInfo ? "请先完善角色的外貌描述，" : ""}
            点击下方的创建按钮创建第一个造型吧！
          </AlertDescription>
        </Alert>
        
        {/* 创建按钮（空状态下也显示） */}
        <div className="mt-4">
          <StyleSidebar
            styles={[]}
            activeStyleId={null}
            onStyleSelect={() => {}}
            onCreateStyle={handleCreateStyle}
            isCreatingStyle={isCreatingStyle || isPending}
            hasBasicInfo={hasBasicInfo}
            jobs={jobs}
          />
        </div>
      </div>
    );
  }

  // 当前激活的造型
  const activeStyle = character.images.find((img) => img.id === activeStyleId);

  // 如果找不到激活的造型，返回 null（useEffect 会自动设置）
  if (!activeStyle) {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* 左侧：造型侧边栏 */}
      <StyleSidebar
        styles={character.images}
        activeStyleId={activeStyleId}
        onStyleSelect={setActiveStyleId}
        onCreateStyle={handleCreateStyle}
        isCreatingStyle={isCreatingStyle || isPending}
        hasBasicInfo={hasBasicInfo}
        jobs={jobs}
      />

      {/* 右侧：造型详情 */}
      <StyleDetailPanel
        projectId={projectId}
        characterId={character.id}
        style={activeStyle}
        jobs={jobs}
        onPreview={onPreview}
      />
    </div>
  );
}
