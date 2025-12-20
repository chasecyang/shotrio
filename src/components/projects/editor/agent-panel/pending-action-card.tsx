"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { PendingAction } from "@/types/agent";
import { AlertTriangle, Loader2, Check, X, ChevronDown } from "lucide-react";
import { formatParameters, expandArrayValue } from "@/lib/utils/agent-params-formatter";

interface PendingActionCardProps {
  action: PendingAction;
  onConfirm: (actionId: string) => Promise<void>;
  onCancel: (actionId: string) => Promise<void>;
}

export function PendingActionCard({
  action,
  onConfirm,
  onCancel,
}: PendingActionCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);

  // 判断操作类型
  const isDeletion = action.functionCalls.some((fc) => fc.category === "deletion");
  const isModification = action.functionCalls.some((fc) => fc.category === "modification");
  const isGeneration = action.functionCalls.some((fc) => fc.category === "generation");

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      await onConfirm(action.id);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = async () => {
    await onCancel(action.id);
  };

  return (
    <Card className="border-2 border-primary/20 bg-card">
      <div className="p-4 space-y-3">
        {/* 执行计划 */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h4 className="text-xs font-semibold mb-3 text-muted-foreground">执行计划</h4>
          <ul className="space-y-3">
            {action.functionCalls.map((fc, index) => {
              const formattedParams = formatParameters(fc.parameters);
              const hasParams = formattedParams.length > 0;

              return (
                <li key={fc.id} className="space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{fc.displayName || fc.name}</div>
                      {fc.reason && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {fc.reason}
                        </div>
                      )}
                      <div className="mt-1">
                        <Badge
                          variant={
                            fc.category === "deletion"
                              ? "destructive"
                              : fc.category === "modification"
                              ? "secondary"
                              : "default"
                          }
                          className="text-xs"
                        >
                          {fc.category === "deletion"
                            ? "删除"
                            : fc.category === "modification"
                            ? "修改"
                            : fc.category === "generation"
                            ? "生成"
                            : "读取"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* 参数详情 */}
                  {hasParams && (
                    <Collapsible className="ml-7">
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1">
                        <ChevronDown className="h-3 w-3" />
                        <span>查看详细参数</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 rounded-md bg-muted/20 p-2.5 space-y-1.5">
                          {formattedParams.map((param) => (
                            <div key={param.key} className="text-xs">
                              <div className="flex gap-2">
                                <span className="text-muted-foreground shrink-0 min-w-[60px]">
                                  {param.label}:
                                </span>
                                <span className="font-medium break-all">
                                  {param.value}
                                </span>
                              </div>
                              {/* 如果是数组且长度>3，展开显示 */}
                              {Array.isArray(param.rawValue) && param.rawValue.length > 3 && (
                                <div className="ml-[68px] mt-0.5 text-muted-foreground">
                                  {expandArrayValue(param.rawValue).map((item, idx) => (
                                    <div key={idx} className="text-[10px]">
                                      · {item}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* 警告提示 */}
        {(isDeletion || isModification) && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2.5 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                {isDeletion && <p>此操作将永久删除数据，无法撤销。</p>}
                {isModification && !isDeletion && (
                  <p>此操作将修改现有数据，请确认无误后执行。</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isExecuting}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-1.5" />
            拒绝
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isExecuting}
            variant={isDeletion ? "destructive" : "default"}
            className="flex-1"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                执行中...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                {isDeletion ? "确认删除" : isGeneration ? "确认生成" : "确认执行"}
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

