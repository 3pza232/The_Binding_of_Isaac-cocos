import { Vec2, Vec3, Node, v3, v2 } from 'cc';
import { IAttackStrategy } from './IAttackStrategy';
import { AttackType } from './Constants';
import { AttackContext } from './AttackContext';
import { EffectPipeline } from './EffectPipeline';
import { GameState } from './GameState';
import { Brimstone } from './Brimstone';
import { LaserTracker } from './LaserTracker';
import type { Shoot } from './Shoot';

const _v3 = v3();

enum BS { IDLE, CHARGING, LASER }

/**
 * 硫磺火激光策略 — 蓄力-发射-追踪状态机。
 * 段链每帧重算：head 锚定玩家偏移，body 逐段递推，
 * 每段经 LaserTracker 搜索附近敌人并独立偏转方向。
 */
export class BrimstoneStrategy implements IAttackStrategy {
    readonly attackType = AttackType.BRIMSTONE;
    private _mgr: Shoot;
    private _state = BS.IDLE;
    private _charge = 0;
    private _laserTimer = 0;
    private _fired = false;

    // ── 追踪 ──
    private _segments: Node[] = [];
    private _segDirs: Vec2[] = [];      // 每段当前方向
    private _baseDir = v2(1, 0);         // 发射基准方向
    private _tracker = new LaserTracker();
    private _scanTimer = 0;
    private _cachedTargets: (Vec3 | null)[] = [];

    constructor(mgr: Shoot) { this._mgr = mgr; }

    init(): void {
        const gs = GameState.i;
        this._state = gs.brimState as BS;
        this._charge = gs.brimCharge;
        this._fired = gs.brimFired;
        this._laserTimer = gs.brimLaserTimer;
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
                this._updateLaserSegments(dt);
                if (this._laserTimer <= 0) {
                    this._cleanupLaser();
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
        this._cleanupLaser();
        this._state = BS.IDLE;
        this._charge = 0;
        this._laserTimer = 0;
        this._fired = false;
        this._saveState();
    }

    // ── 发射 ──

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
        this._baseDir = dir.clone();

        // 创建段链 + 追踪器
        const str = GameState.i.laserTrackingStrength;
        this._tracker = new LaserTracker(str !== 1 ? { steerStrength: 0.08 * str, recoveryStrength: 0.05 * str } : {});
        this._tracker.reset();
        const onHit = (_enemy: Node, idx: number) => { this._tracker.markHit(idx); };

        this._segments = Brimstone.fire(
            this._mgr.node.worldPosition, dir,
            ctx.damage, ctx.color,
            GameState.i.laserHoming ? { onHit } : null,
            this._mgr.node.parent!, this._mgr.node,
        );

        // 初始化每段方向（全部 = baseDir）
        this._segDirs = this._segments.map(() => dir.clone());
    }

    // ── 段链追踪 ──

    private _updateLaserSegments(dt: number): void {
        if (this._segments.length === 0) return;
        const room = this._findRoom();
        if (!room) return;

        this._tracker.tick(dt);
        const gs = GameState.i;
        const pw = this._mgr.node.worldPosition;
        const segSize = Brimstone.segmentSize;
        const offX = Brimstone.offsetX;
        const offY = Brimstone.offsetY;

        // ~10 帧扫描一次敌人
        this._scanTimer -= dt;
        if (this._scanTimer <= 0) {
            this._scanTimer = 0.17;
            this._cachedTargets = [];
            for (let i = 0; i < this._segments.length; i++) {
                const si = i === 0
                    ? v3(pw.x + this._baseDir.x * offX, pw.y + this._baseDir.y * offY, 0)
                    : _v3.set(
                        this._segments[i - 1].worldPosition.x + this._segDirs[i - 1].x * segSize,
                        this._segments[i - 1].worldPosition.y + this._segDirs[i - 1].y * segSize,
                        0,
                    );
                const refDir = i === 0 ? this._baseDir : this._segDirs[i - 1];
                if (gs.laserHoming) {
                    this._cachedTargets.push(this._tracker.search(i, si, refDir, room, refDir));
                } else {
                    this._cachedTargets.push(null);
                }
            }
        }

        // Head (idx 0): 锚定玩家偏移，方向 = 可追踪偏转
        const headNode = this._segments[0];
        const headWorldX = pw.x + this._baseDir.x * offX;
        const headWorldY = pw.y + this._baseDir.y * offY;

        if (gs.laserHoming) {
            const target = this._cachedTargets[0];
            if (target) {
                this._segDirs[0] = this._tracker.steer(this._segDirs[0], target, v3(headWorldX, headWorldY, 0), 0, dt);
            } else {
                this._segDirs[0] = this._tracker.recover(this._segDirs[0], this._baseDir, 0, dt);
            }
        } else {
            this._segDirs[0] = this._baseDir.clone();
        }

        headNode.setWorldPosition(headWorldX, headWorldY, 0);
        _rotateNode(headNode, this._segDirs[0]);

        // Body 段: 从前一段递推
        for (let i = 1; i < this._segments.length; i++) {
            const prev = this._segments[i - 1];
            const seg = this._segments[i];

            // 默认位置 = 前一段位置 + 前一段方向 × 间距
            const defX = prev.worldPosition.x + this._segDirs[i - 1].x * segSize;
            const defY = prev.worldPosition.y + this._segDirs[i - 1].y * segSize;

            if (gs.laserHoming) {
                const defPos = _v3.set(defX, defY, 0);
                const target = this._cachedTargets[i];
                if (target) {
                    this._segDirs[i] = this._tracker.steer(this._segDirs[i], target, defPos, i, dt);
                } else {
                    this._segDirs[i] = this._tracker.recover(this._segDirs[i], this._segDirs[i - 1], i, dt);
                }
            } else {
                this._segDirs[i] = this._segDirs[i - 1].clone();
            }

            // 实际位置 = 前一段位置 + 本段方向（可能已偏转）× 间距
            const pw2 = prev.worldPosition;
            seg.setWorldPosition(
                pw2.x + this._segDirs[i].x * segSize,
                pw2.y + this._segDirs[i].y * segSize,
                0,
            );
            _rotateNode(seg, this._segDirs[i]);
        }
    }

    private _findRoom(): Node | null {
        let n: Node | null = this._mgr.node.parent;
        while (n && !n.getComponent('Room')) n = n.parent;
        return n;
    }

    private _cleanupLaser(): void {
        this._segments.length = 0;
        this._segDirs.length = 0;
        this._cachedTargets.length = 0;
        this._scanTimer = 0;
        this._tracker.reset();
    }

    private _saveState(): void {
        const gs = GameState.i;
        gs.brimState = this._state;
        gs.brimCharge = this._charge;
        gs.brimFired = this._fired;
        gs.brimLaserTimer = this._laserTimer;
    }
}

function _rotateNode(node: Node, dir: Vec2): void {
    node.angle = Math.atan2(dir.y, dir.x) * (180 / Math.PI) + 90;
}
