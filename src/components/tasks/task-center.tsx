"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TaskItem } from "./task-item";
import { useTaskSubscription } from "@/hooks/use-task-subscription";
import { getUserJobs, cancelJob, retryJob } from "@/lib/actions/job-actions";
import { toast } from "sonner";
import { Loader2, CheckCircle, ListTodo, AlertCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Job } from "@/types/job";

interface TaskCenterProps {
  trigger?: React.ReactNode;
}

export function TaskCenter({ trigger }: TaskCenterProps) {
  const [open, setOpen] = useState(false);
  const [historicalJobs, setHistoricalJobs] = useState<Job[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "failed">("active");

  const { jobs: activeJobs, isConnected, error, reconnect } = useTaskSubscription();
  const router = useRouter();

  // 加载历史任务
  const loadHistoricalJobs = async () => {
    setIsLoadingHistory(true);
    try {
      const result = await getUserJobs({
        status: activeTab === "completed" ? "completed" : activeTab === "failed" ? ["failed", "cancelled"] : undefined,
        limit: 20,
      });

      if (result.success && result.jobs) {
        setHistoricalJobs(result.jobs as Job[]);
      }
    } catch (error) {
      console.error("加载历史任务失败:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Tab 切换时加载数据
  useEffect(() => {
    if (open && (activeTab === "completed" || activeTab === "failed")) {
      loadHistoricalJobs();
    }
  }, [activeTab, open]);

  // 取消任务
  const handleCancel = async (jobId: string) => {
    const result = await cancelJob(jobId);
    if (result.success) {
      toast.success("任务已取消");
    } else {
      toast.error(result.error || "取消失败");
    }
  };

  // 重试任务
  const handleRetry = async (jobId: string) => {
    const result = await retryJob(jobId);
    if (result.success) {
      toast.success("任务已重新提交");
      setActiveTab("active");
    } else {
      toast.error(result.error || "重试失败");
    }
  };

  // 查看结果（根据任务类型跳转）
  const handleView = (jobId: string) => {
    // 可以根据任务类型和 projectId 跳转到相应页面
    toast.info("查看功能开发中");
  };

  const activeCount = activeJobs.length;
  const hasActiveJobs = activeCount > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="relative">
            <ListTodo className="w-4 h-4 mr-2" />
            任务中心
            {hasActiveJobs && (
              <Badge
                variant="destructive"
                className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            任务中心
            {hasActiveJobs && (
              <Badge variant="secondary" className="ml-auto">
                {activeCount} 个进行中
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            实时查看所有任务的进度和状态
          </SheetDescription>
        </SheetHeader>

        {/* Connection Status */}
        {!isConnected && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">连接已断开</span>
              <Button size="sm" variant="outline" onClick={reconnect} className="h-7">
                <RefreshCw className="w-3 h-3 mr-1" />
                重连
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" className="text-xs">
              进行中
              {hasActiveJobs && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {activeCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              已完成
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              失败
            </TabsTrigger>
          </TabsList>

          {/* Active Jobs */}
          <TabsContent value="active" className="flex-1 mt-4">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {activeJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">暂无进行中的任务</p>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {activeJobs.map((job) => (
                    <TaskItem
                      key={job.id}
                      job={job}
                      onCancel={handleCancel}
                      onView={handleView}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Completed Jobs */}
          <TabsContent value="completed" className="flex-1 mt-4">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : historicalJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">暂无已完成的任务</p>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {historicalJobs.map((job) => (
                    <TaskItem
                      key={job.id}
                      job={job}
                      onView={handleView}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Failed Jobs */}
          <TabsContent value="failed" className="flex-1 mt-4">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : historicalJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">暂无失败的任务</p>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {historicalJobs.map((job) => (
                    <TaskItem
                      key={job.id}
                      job={job}
                      onRetry={handleRetry}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

