import { Sparkles, User, Eye } from "lucide-react";
import { EditableField, EditableTextarea } from "@/components/ui/inline-editable-field";

interface CharacterBasicInfoTabProps {
  description: string;
  appearance: string;
  onDescriptionChange: (value: string) => void;
  onAppearanceChange: (value: string) => void;
  hasBasicInfo: boolean;
}

export function CharacterBasicInfoTab({
  description,
  appearance,
  onDescriptionChange,
  onAppearanceChange,
  hasBasicInfo,
}: CharacterBasicInfoTabProps) {
  return (
    <div className="p-3 space-y-3">
      <div className="space-y-3">
        {/* 角色设定 */}
        <EditableField
          label="角色设定"
          icon={User}
          tooltip="描述角色的性格、背景、职业等基本设定信息"
        >
          <EditableTextarea
            value={description}
            onChange={onDescriptionChange}
            placeholder="例如：性格开朗活泼，是学校的人气偶像。出身音乐世家，擅长钢琴和声乐..."
            emptyText="点击输入角色设定"
            minHeight="min-h-[80px]"
          />
        </EditableField>

        {/* 外貌描述 */}
        <EditableField
          label="外貌描述"
          icon={Eye}
          tooltip="描述角色固定的外貌特征，如发色、瞳色、身高、体型等不会变化的特点"
        >
          <EditableTextarea
            value={appearance}
            onChange={onAppearanceChange}
            placeholder="例如：银色长发及腰，红色眼瞳，左眼下方有泪痣。身材高挑，约170cm..."
            emptyText="点击输入外貌描述"
            minHeight="min-h-[80px]"
          />
        </EditableField>

        {/* 提示信息 */}
        {!hasBasicInfo && (
          <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex gap-2">
              <Sparkles className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-orange-900 dark:text-orange-200">
                  完善角色信息后即可创建造型
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
