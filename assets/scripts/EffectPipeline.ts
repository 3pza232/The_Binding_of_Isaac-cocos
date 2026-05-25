import { AttackContext } from './AttackContext';

export type EffectModifier = (ctx: AttackContext) => void;

/** 效果管线 — 藏品在此注册动态修饰器，攻击时统一 apply */
export class EffectPipeline {
    private static _mods: EffectModifier[] = [];

    static register(fn: EffectModifier): void {
        this._mods.push(fn);
    }

    static clear(): void {
        this._mods.length = 0;
    }

    static apply(ctx: AttackContext): AttackContext {
        for (const fn of this._mods) fn(ctx);
        return ctx;
    }
}
