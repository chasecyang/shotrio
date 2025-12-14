"use server";

import type { Job, JobType } from "@/types/job";
import { startJob } from "@/lib/actions/job";

/**
 * 处理器函数类型
 */
export type ProcessorFunction = (job: Job, workerToken: string) => Promise<void>;

/**
 * 处理器注册表
 * 用于管理所有任务处理器，替代巨大的switch语句
 */
class ProcessorRegistry {
  private processors = new Map<JobType, ProcessorFunction>();

  /**
   * 注册一个处理器
   */
  register(type: JobType, processor: ProcessorFunction): void {
    if (this.processors.has(type)) {
      console.warn(`[ProcessorRegistry] 处理器 ${type} 已存在，将被覆盖`);
    }
    this.processors.set(type, processor);
  }

  /**
   * 批量注册处理器
   */
  registerAll(processors: Record<string, ProcessorFunction>): void {
    for (const [type, processor] of Object.entries(processors)) {
      this.register(type as JobType, processor);
    }
  }

  /**
   * 获取处理器
   */
  get(type: JobType): ProcessorFunction | undefined {
    return this.processors.get(type);
  }

  /**
   * 检查是否已注册处理器
   */
  has(type: JobType): boolean {
    return this.processors.has(type);
  }

  /**
   * 处理任务
   * 查找对应的processor并执行
   */
  async process(job: Job, workerToken: string): Promise<void> {
    const processor = this.processors.get(job.type);
    
    if (!processor) {
      throw new Error(`未知的任务类型: ${job.type}`);
    }

    // 在开始处理前，先将任务状态标记为 processing
    // 这样可以防止任务被重复获取和执行
    await startJob(job.id, workerToken);

    return processor(job, workerToken);
  }

  /**
   * 获取所有已注册的任务类型
   */
  getRegisteredTypes(): JobType[] {
    return Array.from(this.processors.keys());
  }
}

/**
 * 全局处理器注册表实例
 */
export const registry = new ProcessorRegistry();

