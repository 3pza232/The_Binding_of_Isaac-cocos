import { Vec2, Vec3 } from 'cc';
import { IAttackStrategy } from './IAttackStrategy';
import { AttackType, ROOM_SPACING_X, ROOM_SPACING_Y } from './Constants';
import { AttackContext } from './AttackContext';
import { EffectPipeline } from './EffectPipeline';
import { GameState } from './GameState';
import { Brimstone } from './Brimstone';
import type { Shoot } from './Shoot';

const ROOM_DIAG = Math.sqrt(ROOM_SPACING_X ** 2 + ROOM_SPACING_Y ** 2);

enum BS { IDLE, CHARGING, LASER }

/**
 * 硫磺火激光策略 — 蓄力-发射状态机。
 * 状态通过 GameState 跨房间持久化。
 */
export class BrimstoneStrategy implements IAttackStrategy {
    readonly attackType = AttackType.BRIMSTONE;
    private _mgr: Shoot;
    private _state = BS.IDLE;
    private _charge = 0;
    private _laserTimer = 0;
    private _fired = false;

    constructor(mgr: Shoot) { this._mgr = mgr; }

    init(): void {
        const gs = GameState.i;
        this._state = gs.brimState as BS;
        this._charge = gs.brimCharge;
        this._fired = gs.brimFired;
        this._laserTimer = gs.brimLaserTimer;
        // 跨房间恢复蓄力条显示
        if (this._state === BS.CHARGING && Brimstone.chargeTime > 0) {
            this._mgr.updateChargeBar(Math.min(this._charge / Brimstone.chargeTime, 1));
        }
    }

    update(dt: number): void {
        const head = this._mgr.head;

        if (head.fireDir !== null) this._fired = false;

        switch (this._state) {
            case BS.IDLE:
                if (!this._fired && head.fireDir === null && head.aimDirection) {
                    this._state = BS.CHARGING;
                    this._charge = 0;
                    GameState.i.brimCharged = false;
                    this._mgr.updateChargeBar(0);
                }
                break;

            case BS.CHARGING:
                if (head.fireDir !== null) {
                    this._mgr.clearChargeBar();
                    if (this._charge >= Brimstone.chargeTime || GameState.i.brimCharged) {
                        this._fire(head.fireDir);
                    } else {
                        this._state = BS.IDLE;
                    }
                } else if (head.aimDirection) {
                    this._charge += dt;
                    const ratio = Math.min(this._charge / Brimstone.chargeTime, 1);
                    this._mgr.updateChargeBar(ratio);
                    if (ratio >= 1) {
                        GameState.i.brimCharged = true;
                    }
                } else {
                    this._state = BS.IDLE;
                    this._mgr.clearChargeBar();
                }
                break;

            case BS.LASER:
                this._laserTimer -= dt;
                if (this._laserTimer <= 0) {
                    if (head.fireDir === null && head.aimDirection) {
                        this._state = BS.CHARGING;
                        this._charge = 0;
                        this._mgr.updateChargeBar(0);
                    } else {
                        this._state = BS.IDLE;
                        this._fired = true;
                    }
                }
                break;
        }

        this._saveState();
    }

    destroy(): void {
        this._mgr.clearChargeBar();
        this._state = BS.IDLE;
        this._charge = 0;
        this._laserTimer = 0;
        this._fired = false;
        this._saveState();
    }

    private _fire(dir: Vec2): void {
        this._mgr.clearChargeBar();
        if (this._mgr.brimstoneFireSound) {
            this._mgr.audioSrc.playOneShot(this._mgr.brimstoneFireSound, this._mgr.fireVolume);
        }

        const gs = GameState.i;
        const ctx = new AttackContext();
        ctx.dir.set(dir);
        ctx.damage = Math.max(1, gs.tearDamage * gs.damageMul);
        EffectPipeline.apply(ctx);

        GameState.i.brimCharged = false;
        this._state = BS.LASER;
        this._laserTimer = Brimstone.laserDuration + Brimstone.fadeTime;
        this._fired = true;
        Brimstone.fire(
            this._mgr.node.worldPosition, dir,
            ctx.damage, ctx.color,
            this._mgr.node.parent!, this._mgr.node,
        );
    }

    private _saveState(): void {
        const gs = GameState.i;
        gs.brimState = this._state;
        gs.brimCharge = this._charge;
        gs.brimFired = this._fired;
        gs.brimLaserTimer = this._laserTimer;
    }
}
