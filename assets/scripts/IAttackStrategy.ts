import { AttackType } from './Constants';

/** 攻击策略接口 — 每个攻击类型实现此接口 */
export interface IAttackStrategy {
    readonly attackType: AttackType;

    /** 跨房间恢复时调用（从 GameState 读取持久化状态） */
    init(): void;

    /** 每帧逻辑 */
    update(dt: number): void;

    /** 切换离开时清理 */
    destroy(): void;
}
