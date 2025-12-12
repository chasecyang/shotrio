"use client";

import { MousePointerClick } from "lucide-react";

export function EmptyPreview() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <MousePointerClick className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">选择一个项目</h3>
        <p className="text-sm text-muted-foreground">
          从左侧资源面板选择剧集、角色或场景进行编辑，
          <br />
          或从下方时间轴选择分镜进行编辑。
        </p>
      </div>
    </div>
  );
}

