import type { Job } from "@/types/job";

export interface TaskNode {
  job: Partial<Job>;
  children: TaskNode[];
}

/**
 * 将任务列表转换为树形结构
 * 父任务在上，子任务作为 children
 */
export function buildTaskTree(jobs: Partial<Job>[]): TaskNode[] {
  // 创建任务映射表，用于快速查找
  const jobMap = new Map<string, TaskNode>();
  const rootNodes: TaskNode[] = [];

  // 第一遍遍历：创建所有节点
  jobs.forEach((job) => {
    if (job.id) {
      jobMap.set(job.id, {
        job,
        children: [],
      });
    }
  });

  // 第二遍遍历：建立父子关系
  jobs.forEach((job) => {
    if (!job.id) return;

    const node = jobMap.get(job.id);
    if (!node) return;

    if (job.parentJobId) {
      // 如果有父任务ID，将当前节点添加到父节点的children中
      const parentNode = jobMap.get(job.parentJobId);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // 父任务不在当前列表中，作为根节点
        rootNodes.push(node);
      }
    } else {
      // 没有父任务ID，是根节点
      rootNodes.push(node);
    }
  });

  // 对子任务按创建时间排序（新的在前）
  const sortChildren = (node: TaskNode) => {
    node.children.sort((a, b) => {
      const timeA = a.job.createdAt ? new Date(a.job.createdAt).getTime() : 0;
      const timeB = b.job.createdAt ? new Date(b.job.createdAt).getTime() : 0;
      return timeB - timeA; // 降序：新的在前
    });
    node.children.forEach(sortChildren);
  };

  rootNodes.forEach(sortChildren);

  // 对根节点按创建时间排序（新的在前）
  rootNodes.sort((a, b) => {
    const timeA = a.job.createdAt ? new Date(a.job.createdAt).getTime() : 0;
    const timeB = b.job.createdAt ? new Date(b.job.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return rootNodes;
}

/**
 * 扁平化任务树，返回所有任务（包括子任务）
 */
export function flattenTaskTree(nodes: TaskNode[]): Partial<Job>[] {
  const result: Partial<Job>[] = [];
  
  const flatten = (node: TaskNode) => {
    result.push(node.job);
    node.children.forEach(flatten);
  };

  nodes.forEach(flatten);
  return result;
}

/**
 * 获取任务的所有子任务ID（递归）
 */
export function getChildJobIds(node: TaskNode): string[] {
  const ids: string[] = [];
  
  const collect = (n: TaskNode) => {
    n.children.forEach((child) => {
      if (child.job.id) {
        ids.push(child.job.id);
      }
      collect(child);
    });
  };

  collect(node);
  return ids;
}

/**
 * 检查任务节点是否包含正在进行的任务（包括子任务）
 */
export function hasActiveTask(node: TaskNode): boolean {
  const activeStatuses = ["pending", "processing"];
  
  if (node.job.status && activeStatuses.includes(node.job.status)) {
    return true;
  }

  return node.children.some(hasActiveTask);
}

/**
 * 获取任务节点的总体状态（考虑子任务）
 */
export function getNodeOverallStatus(node: TaskNode): {
  status: string;
  allCompleted: boolean;
  hasFailures: boolean;
  activeCount: number;
  totalCount: number;
} {
  let allCompleted = true;
  let hasFailures = false;
  let activeCount = 0;
  let totalCount = 0;

  const analyze = (n: TaskNode) => {
    totalCount++;
    
    if (n.job.status === "pending" || n.job.status === "processing") {
      allCompleted = false;
      activeCount++;
    } else if (n.job.status === "failed") {
      hasFailures = true;
      allCompleted = false;
    } else if (n.job.status === "cancelled") {
      allCompleted = false;
    }

    n.children.forEach(analyze);
  };

  analyze(node);

  let status = node.job.status || "pending";
  
  // 如果有子任务，根据子任务状态调整父任务状态
  if (node.children.length > 0) {
    if (activeCount > 0) {
      status = "processing";
    } else if (hasFailures) {
      status = "failed";
    } else if (allCompleted) {
      status = "completed";
    }
  }

  return {
    status,
    allCompleted,
    hasFailures,
    activeCount,
    totalCount,
  };
}

