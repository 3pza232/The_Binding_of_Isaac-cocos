/** 补回 Cocos 项目依赖的最小全局 API，避免引入完整 DOM 类型 */
declare function setTimeout(cb: (...args: any[]) => void, ms: number): number;
declare function setInterval(cb: (...args: any[]) => void, ms: number): number;
declare function clearTimeout(id: number): void;
declare var console: {
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
};
