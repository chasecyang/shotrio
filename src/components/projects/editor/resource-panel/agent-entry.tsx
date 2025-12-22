"use client";

import { Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEditor } from "../editor-context";

interface AgentEntryProps {
  projectId: string;
}

export function AgentEntry({ projectId }: AgentEntryProps) {
  const { dispatch } = useEditor();

  const handleOpenAgent = () => {
    dispatch({
      type: "SELECT_RESOURCE",
      payload: { type: "agent", id: projectId },
    });
  };

  return (
    <div className="p-3 space-y-3">
      <Card 
        className="p-6 cursor-pointer hover:bg-accent/50 transition-colors border-2 border-dashed"
        onClick={handleOpenAgent}
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1">
              <Sparkles className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">AI 助手</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              让 AI 帮你编写剧本、生成分镜、调整素材
            </p>
          </div>

          <Button 
            variant="default" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenAgent();
            }}
          >
            开始对话
          </Button>
        </div>
      </Card>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p className="font-medium">你可以尝试：</p>
        <ul className="space-y-1 pl-4">
          <li>• 帮我写一段动作场景的剧本</li>
          <li>• 为第一集生成10个分镜</li>
          <li>• 生成一个赛博朋克风格的角色</li>
        </ul>
      </div>
    </div>
  );
}

