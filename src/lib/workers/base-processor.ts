"use server";

import type { Job } from "@/types/job";
import { updateJobProgress, completeJob, failJob } from "@/lib/actions/job";
import { verifyProjectOwnership } from "./utils/validation";

/**
 * 基础任务处理器抽象类
 * 所有processor都应该继承这个类，以统一错误处理、进度管理等逻辑
 * 
 * @template TInput - 输入数据类型
 * @template TResult - 输出结果类型
 */
export abstract class BaseProcessor<TInput = unknown, TResult = unknown> {
  constructor(
    protected readonly job: Job,
    protected readonly workerToken: string
  ) {}

  /**
   * 执行任务的主流程
   * 这是统一的任务执行入口，不需要在子类中重写
   * 
   * 注意：任务状态标记为 processing 由 processor-registry 统一处理
   */
  async execute(): Promise<void> {
    try {
      // 1. 解析和验证输入
      const input = this.parseInput();
      await this.validate(input);

      // 2. 验证项目所有权（如果有projectId）
      if (this.job.projectId) {
        await this.verifyAccess();
      }

      // 3. 执行实际的业务逻辑
      const result = await this.process(input);

      // 4. 完成任务
      await completeJob(
        {
          jobId: this.job.id,
          resultData: result,
        },
        this.workerToken
      );
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * 解析输入数据
   * 可以在子类中重写以实现自定义的解析逻辑
   */
  protected parseInput(): TInput {
    return (this.job.inputData || {}) as TInput;
  }

  /**
   * 验证输入数据
   * 子类必须实现这个方法，用于验证输入参数的有效性
   */
  protected abstract validate(input: TInput): Promise<void>;

  /**
   * 验证项目访问权限
   * 默认实现检查项目所有权，子类可以重写以实现自定义的权限验证
   */
  protected async verifyAccess(): Promise<void> {
    if (this.job.projectId) {
      const hasAccess = await verifyProjectOwnership(
        this.job.projectId,
        this.job.userId
      );
      if (!hasAccess) {
        throw new Error("无权访问该项目");
      }
    }
  }

  /**
   * 处理任务的核心业务逻辑
   * 子类必须实现这个方法
   */
  protected abstract process(input: TInput): Promise<TResult>;

  /**
   * 更新任务进度
   * 便捷方法，用于在process中更新进度
   */
  protected async updateProgress(
    progress: number,
    message: string
  ): Promise<void> {
    await updateJobProgress(
      {
        jobId: this.job.id,
        progress,
        progressMessage: message,
      },
      this.workerToken
    );
  }

  /**
   * 处理错误
   * 子类可以重写以实现自定义的错误处理逻辑
   */
  protected async handleError(error: unknown): Promise<void> {
    console.error(`[${this.job.type}] 处理任务 ${this.job.id} 失败:`, error);

    await failJob(
      {
        jobId: this.job.id,
        errorMessage:
          error instanceof Error ? error.message : "处理任务失败",
      },
      this.workerToken
    );
  }

  /**
   * 记录日志
   * 带任务ID前缀的日志方法
   */
  protected log(message: string, ...args: unknown[]): void {
    console.log(`[${this.job.type}:${this.job.id}] ${message}`, ...args);
  }

  /**
   * 记录错误日志
   */
  protected logError(message: string, error?: unknown): void {
    console.error(`[${this.job.type}:${this.job.id}] ${message}`, error);
  }
}

/**
 * 创建processor工厂函数
 * 用于简化processor的导出
 * 
 * @example
 * export const processSceneImage = createProcessorHandler(SceneImageProcessor);
 */
export function createProcessorHandler<TInput, TResult>(
  ProcessorClass: new (job: Job, token: string) => BaseProcessor<TInput, TResult>
) {
  return async (job: Job, workerToken: string): Promise<void> => {
    const processor = new ProcessorClass(job, workerToken);
    await processor.execute();
  };
}

