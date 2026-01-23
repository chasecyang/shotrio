/**
 * 依赖未就绪错误
 * 当任务依赖的资源（如图片）还在生成中时抛出此错误
 * Worker 会捕获此错误并重新排队任务，而不是标记为失败
 */
export class DependencyNotReadyError extends Error {
  public readonly waitingFor: Array<{
    assetId: string;
    imageDataId: string;
  }>;

  constructor(
    message: string,
    waitingFor: Array<{
      assetId: string;
      imageDataId: string;
    }>
  ) {
    super(message);
    this.name = "DependencyNotReadyError";
    this.waitingFor = waitingFor;

    // 保持正确的原型链（TypeScript 继承 Error 的问题）
    Object.setPrototypeOf(this, DependencyNotReadyError.prototype);
  }
}
