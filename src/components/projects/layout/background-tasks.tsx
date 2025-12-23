"use client";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TaskProgressBar } from "@/components/tasks/task-progress-bar";
import { getUserJobs, cancelJob, retryJob, getJobDetail } from "@/lib/actions/job/user-operations";
import { getJobsDetails, type JobDetails } from "@/lib/actions/job/details";
import { toast } from "sonner";
import { useEditor } from "../editor/editor-context";
import {
  Activity,
  Loader2,
  RotateCcw,
  X as XIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/job";
import { buildTaskTree, getNodeOverallStatus, type TaskNode } from "@/lib/utils/task-tree";
import { 
  getTaskTypeLabel, 
  getTaskStatusConfig, 
  VIEWABLE_TASK_TYPES,
  formatTaskTime
} from "@/lib/constants/task-labels";

export function BackgroundTasks() {
  const { jobs: activeJobs } = useEditor();
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [jobDetails, setJobDetails] = useState<Map<string, JobDetails>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // 加载最近的任务（包括已完成和失败的）
  const loadRecentJobs = async () => {
    setIsLoading(true);
    try {
      const result = await getUserJobs({ limit: 20 }); // 增加限制以获取更多任务（包括子任务）
      if (result.success && result.jobs) {
        const jobs = result.jobs as Job[];
        setRecentJobs(jobs);
        
        // 获取所有任务的详细信息
        const allJobs = [...activeJobs, ...jobs];
        const details = await getJobsDetails(allJobs);
        setJobDetails(details);
      }
    } catch (error) {
      console.error("加载任务失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 当活动任务变化时，更新它们的详细信息
  useEffect(() => {
    if (activeJobs.length > 0) {
      getJobsDetails(activeJobs).then(setJobDetails);
    }
  }, [activeJobs]);

  // 合并活动任务和历史任务，活动任务置顶
  const allJobs = [
    ...activeJobs,
    ...recentJobs.filter(
      (job) => !activeJobs.some((activeJob) => activeJob.id === job.id)
    ),
  ];

  // 构建任务树
  const taskTree = buildTaskTree(allJobs);
  
  // 只显示前10个根任务（包括它们的子任务）
  const displayedTree = taskTree.slice(0, 10);

  // 优化后的统计逻辑：
  // 1. 统计根任务中有活动任务的数量
  // 2. 统计所有活动的子任务总数
  const { rootTaskCount, totalActiveCount } = taskTree.reduce(
    (acc, node) => {
      const overallStatus = getNodeOverallStatus(node);
      if (overallStatus.activeCount > 0) {
        acc.rootTaskCount += 1;
        acc.totalActiveCount += overallStatus.activeCount;
      }
      return acc;
    },
    { rootTaskCount: 0, totalActiveCount: 0 }
  );

  // 显示活跃的根任务数量
  const activeCount = rootTaskCount;

  // 切换节点展开/折叠
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

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
    } else {
      toast.error(result.error || "重试失败");
    }
  };

  // 查看结果（根据任务类型）
  const handleView = async (jobId: string) => {
    const job = allJobs.find((j) => j.id === jobId);
    if (!job) {
      toast.error("任务不存在");
      return;
    }

    // 根据任务类型处理
    try {
      switch (job.type) {
        default:
          toast.info("该任务暂不支持查看结果");
          break;
      }
    } catch (error) {
      console.error("解析任务数据失败:", error);
      toast.error("无法解析任务数据");
    }
  };

  return (
    <TooltipProvider>
      <DropdownMenu onOpenChange={(open) => open && loadRecentJobs()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "relative h-9 w-9 p-0 transition-colors",
                  activeCount > 0 && "text-primary"
                )}
              >
                <Activity className="h-4 w-4" />
                {activeCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
                  >
                    {activeCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              后台任务
              {activeCount > 0 && (
                <>
                  {" "}({activeCount} 个任务
                  {totalActiveCount > activeCount && `, ${totalActiveCount} 个子任务`}
                  )
                </>
              )}
            </p>
          </TooltipContent>
        </Tooltip>

      <DropdownMenuContent align="end" className="w-[380px]">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">后台任务</h4>
            {activeCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                  {activeCount} 个任务
                </Badge>
                {totalActiveCount > activeCount && (
                  <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-muted-foreground">
                    {totalActiveCount} 个子任务
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayedTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Activity className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">暂无任务</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {displayedTree.map((node) => (
                <TaskNodeItem
                  key={node.job.id}
                  node={node}
                  details={jobDetails.get(node.job.id || "")}
                  isExpanded={expandedNodes.has(node.job.id || "")}
                  onToggle={toggleNode}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                  onView={handleView}
                  jobDetails={jobDetails}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
    </TooltipProvider>
  );
}

interface TaskNodeItemProps {
  node: TaskNode;
  details?: JobDetails;
  isExpanded: boolean;
  onToggle: (nodeId: string) => void;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onView: (jobId: string) => void;
  jobDetails: Map<string, JobDetails>;
  depth?: number;
}

function TaskNodeItem({ 
  node, 
  details, 
  isExpanded, 
  onToggle, 
  onCancel, 
  onRetry, 
  onView, 
  jobDetails,
  depth = 0 
}: TaskNodeItemProps) {
  const job = node.job;
  const hasChildren = node.children.length > 0;
  const taskType = getTaskTypeLabel(job.type || "", "sm");
  const status = getTaskStatusConfig(job.status || "pending", "sm");
  
  // 获取节点整体状态（考虑子任务）
  const overallStatus = hasChildren ? getNodeOverallStatus(node) : null;

  const canCancel = job.status === "pending" || job.status === "processing";
  const canRetry = job.status === "failed" || job.status === "cancelled";
  
  // 只有已完成且支持查看的任务类型才显示"查看结果"按钮
  // 注意：character_extraction 和 scene_extraction 在资源面板中显示横幅，不需要在这里查看
  const canView = job.status === "completed" && 
                  job.type && 
                  VIEWABLE_TASK_TYPES.includes(job.type as any) &&
                  !job.isImported;

  const isCompleted = job.status === "completed" || job.status === "failed" || job.status === "cancelled";

  // 使用详细信息或回退到默认标签
  const displayTitle = details?.displayTitle || taskType.label;
  const displaySubtitle = details?.displaySubtitle;
  
  // 如果有详细信息，显示任务类型作为标签
  const showTypeLabel = details && details.displayTitle !== taskType.label;

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "rounded-lg border bg-card p-3 space-y-2 transition-all hover:shadow-sm",
          isCompleted && "opacity-60 hover:opacity-100",
          depth > 0 && "ml-6 border-l-2 border-l-primary/20"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* 展开/折叠按钮 */}
            {hasChildren ? (
              <button
                onClick={() => onToggle(job.id!)}
                className="shrink-0 hover:bg-accent rounded p-0.5 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            ) : (
              <div className="w-4" /> /* 占位符，保持对齐 */
            )}
            
            {taskType.icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h5 className="font-medium text-xs truncate">
                  {displayTitle}
                </h5>
                {showTypeLabel && (
                  <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
                    {taskType.label}
                  </span>
                )}
                {/* 显示子任务数量和进度 */}
                {hasChildren && overallStatus && (
                  <div className="flex items-center gap-1">
                    {overallStatus.activeCount > 0 && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 h-4">
                        {overallStatus.activeCount} 进行中
                      </Badge>
                    )}
                    {overallStatus.completedCount > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-green-600 dark:text-green-400">
                        {overallStatus.completedCount} 完成
                      </Badge>
                    )}
                    {overallStatus.failedCount > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-red-600 dark:text-red-400">
                        {overallStatus.failedCount} 失败
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              {displaySubtitle && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {displaySubtitle}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">{formatTaskTime(job.createdAt)}</p>
            </div>
          </div>

          <div className={cn("flex items-center gap-1", status.color)}>
            {status.icon}
            <span className="text-[10px] font-medium">{status.label}</span>
          </div>
        </div>

        {/* Progress */}
        {(job.status === "pending" || job.status === "processing") && (
          <div>
            <TaskProgressBar
              progress={job.progress || 0}
              status={job.status}
              currentStep={job.currentStep}
              totalSteps={job.totalSteps}
            />
            {job.progressMessage && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {job.progressMessage}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {job.status === "failed" && job.errorMessage && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded px-2 py-1">
            <p className="text-[10px] text-red-600 dark:text-red-400 line-clamp-2">
              {job.errorMessage}
            </p>
          </div>
        )}

        {/* Actions */}
        {(canCancel || canRetry || canView) && (
          <div className="flex items-center gap-2">
            {canView && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={() => onView(job.id!)}
              >
                查看结果
              </Button>
            )}
            
            {canRetry && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={() => onRetry(job.id!)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                重试
              </Button>
            )}

            {canCancel && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive ml-auto"
                onClick={() => onCancel(job.id!)}
              >
                <XIcon className="w-3 h-3 mr-1" />
                取消
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 递归渲染子任务 */}
      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children.map((childNode) => (
            <TaskNodeItem
              key={childNode.job.id}
              node={childNode}
              details={jobDetails.get(childNode.job.id || "")}
              isExpanded={false} // 子任务默认不展开，可以根据需求修改
              onToggle={onToggle}
              onCancel={onCancel}
              onRetry={onRetry}
              onView={onView}
              jobDetails={jobDetails}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
