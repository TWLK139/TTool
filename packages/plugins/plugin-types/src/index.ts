/** 插件宿主（基座）提供的 API */
export interface TToolHost {
  /** 基座就绪回调 */
  onReady(callback: () => void): void;
  /** 发送消息给其他插件 */
  emit(event: string, ...args: unknown[]): void;
  /** 监听其他插件的消息 */
  on(event: string, callback: (...args: unknown[]) => void): void;
}

/** 插件定义 */
export interface TToolPlugin {
  /** 插件名称（唯一标识） */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** 插件激活时调用 */
  activate(host: TToolHost): void;
  /** 插件停用时调用 */
  deactivate?(): void;
}
