import { _decorator, Node, Sprite, Prefab, instantiate, Vec2, Vec3 } from 'cc';
import { IAttackStrategy } from './IAttackStrategy';
import { AttackType } from './Constants';
import { AttackContext } from './AttackContext';
import { EffectPipeline } from './EffectPipeline';
import { GameState } from './GameState';
import { Tear } from './Tear';
import type { Shoot } from './Shoot';

/**
 * 普通泪弹策略 — 按射速间隔朝瞄准方向发射泪弹。
 * 所有参数从 GameState + Shoot 属性读取，经 EffectPipeline 修饰后发射。
 */
export class NormalTearStrategy implements IAttackStrategy {
    readonly attackType = AttackType.NORMAL;
    private _mgr: Shoot;
    private _cooldown = 0;

    constructor(mgr: Shoot) { this._mgr = mgr; }

    init(): void { this._cooldown = 0; }

    update(dt: number): void {
        this._cooldown -= dt;
        if (this._cooldown > 0) return;

        const dir = this._mgr.head.aimDirection;
        if (!dir) return;

        this._cooldown = GameState.i.fireRate;
        this._spawn(dir);
    }

    destroy(): void {}

    private _spawn(dir: Vec2): void {
        const gs = GameState.i;
        const m = this._mgr;
        const bv = m.body.velocity;

        const ctx = new AttackContext();
        ctx.dir.set(dir);
        ctx.pos.set(m.calcSpawnPos(dir));
        ctx.damage = Math.max(1, gs.tearDamage * gs.damageMul);
        ctx.speed = gs.tearSpeed;
        ctx.range = gs.range;
        ctx.fallSpeed = m.fallSpeed;
        ctx.fallStartRatio = m.fallStartRatio;
        ctx.enemyPiercing = gs.enemyPiercing;
        ctx.wallPiercing = gs.wallPiercing;
        ctx.homing = gs.homing;
        ctx.momentumX = bv.x * m.momentumFactor;
        ctx.momentumY = bv.y * m.momentumFactor;
        ctx.breakSound = m.breakSound;
        ctx.breakVolume = m.breakVolume;
        ctx.spriteFrame = gs.tearSf;

        EffectPipeline.apply(ctx);

        const tear = instantiate(m.tearPrefab);
        tear.setParent(m.node.parent!);
        tear.setWorldPosition(ctx.pos);

        const tc = tear.getComponent(Tear);
        if (tc) {
            tc.init(
                ctx.dir, ctx.speed, ctx.range,
                ctx.fallSpeed, ctx.fallStartRatio,
                ctx.enemyPiercing, ctx.wallPiercing,
                ctx.momentumX, ctx.momentumY,
                ctx.damage, ctx.breakSound, ctx.breakVolume,
                ctx.homing,
            );

            const body = tear.getChildByName('Body');
            if (body) {
                const sp = body.getComponent(Sprite);
                if (ctx.spriteFrame) sp.spriteFrame = ctx.spriteFrame;
                sp.color = ctx.color;
            }

            if (m.fireSound) m.audioSrc.playOneShot(m.fireSound, m.fireVolume);
        }
    }
}
