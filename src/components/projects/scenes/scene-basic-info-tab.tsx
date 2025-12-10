"use client";

import { FileText } from "lucide-react";
import { 
  EditableField, 
  EditableTextarea,
} from "@/components/ui/inline-editable-field";

interface SceneBasicInfoTabProps {
  description: string;
  onDescriptionChange: (value: string) => void;
}

export function SceneBasicInfoTab({ 
  description, 
  onDescriptionChange 
}: SceneBasicInfoTabProps) {
  return (
    <div className="p-4 space-y-4">
      <EditableField
        label="场景描述"
        icon={FileText}
        tooltip="详细描述场景的氛围、环境特征、装饰风格、光线条件等，这个描述会作为 AI 生成场景图片的参考基础。可以包含时间（白天/夜晚）、位置（内景/外景）、氛围等信息。"
      >
        <EditableTextarea
          value={description}
          onChange={onDescriptionChange}
          placeholder="例如：一间温馨的咖啡厅内景，柔和的下午阳光透过落地窗洒进来，原木色的桌椅，墙上挂着复古海报，吧台后方摆放着各式咖啡器具，整体氛围轻松惬意..."
          emptyText="点击输入场景描述"
          rows={6}
          minHeight="min-h-[150px]"
        />
      </EditableField>
    </div>
  );
}

