import { Node, Prefab, Vec2, Vec3, Color, Collider2D } from 'cc';
import { Brimstone } from './Brimstone';
import { BrimstoneLaser } from './BrimstoneLaser';
import { GROUP } from './Constants';

/** 敌人激光发射参数 */
export interface EnemyLaserConfig {
    worldPos: Vec3;
    dir: Vec2;
    damage: number;
    headPrefab: Prefab;
    bodyPrefab: Prefab;
    segmentSize: number;
    offset: number;
    laserDuration: number;
    tickRate: number;
    fadeTime?: number;
    parent: Node;
}

/**
 * 通用敌人激光工具 — 任何怪物可复用。
 * 封装 Brimstone 静态属性注入、段链创建、碰撞组修正、玩家伤害检测。
 *
 * 用法：
 *   const segs = EnemyLaser.fire({ ... });
 *   // 每帧/每 tick 调用 EnemyLaser.damagePlayers(segs);
 *   // 结束后调用 EnemyLaser.cleanup(segs);
 */
export class EnemyLaser {

    /** 发射激光，返回全部段节点 */
    static fire(cfg: EnemyLaserConfig): Node[] {
        const saved = EnemyLaser._saveBrimstoneState();
        EnemyLaser._applyBrimstoneConfig(cfg);
        const segments = Brimstone.fire(cfg.worldPos, cfg.dir, cfg.damage, Color.WHITE, null, cfg.parent, cfg.parent);
        EnemyLaser._restoreBrimstoneState(saved);

        for (const seg of segments) {
            const bl = seg.getComponent(BrimstoneLaser);
            if (bl) bl.trackingMode = true;
            const collider = seg.getComponent(Collider2D);
            if (collider) collider.group = GROUP.ENEMY_BULLET;
        }
        return segments;
    }

    /** 对所有段中接触到的玩家造成一次伤害（按 tickRate 调用），owner 为发射激光的怪物 */
    static damagePlayers(segments: Node[], owner: Node): void {
        for (const seg of segments) {
            if (!seg.isValid) continue;
            const bl = seg.getComponent(BrimstoneLaser);
            if (!bl) continue;
            bl.walkContacts(
                c => c.group === GROUP.PLAYER,
                playerNode => {
                    const ph = playerNode.getComponent('PlayerHealth') as any;
                    if (ph?.alive && !ph.isInvulnerable) ph.takeHit(owner);
                },
            );
        }
    }

    /** 销毁全部段并清空数组 */
    static cleanup(segments: Node[]): void {
        for (const seg of segments) {
            if (seg && seg.isValid) seg.destroy();
        }
        segments.length = 0;
    }

    // ── Brimstone 静态属性 保存/注入/恢复 ──

    private static _saveBrimstoneState() {
        return {
            laserDuration: Brimstone.laserDuration,
            tickRate: Brimstone.tickRate,
            fadeTime: Brimstone.fadeTime,
            headPrefab: Brimstone.headPrefab,
            bodyPrefab: Brimstone.bodyPrefab,
            segmentSize: Brimstone.segmentSize,
            offsetX: Brimstone.offsetX,
            offsetY: Brimstone.offsetY,
        };
    }

    private static _applyBrimstoneConfig(cfg: EnemyLaserConfig): void {
        Brimstone.laserDuration = cfg.laserDuration;
        Brimstone.tickRate = cfg.tickRate;
        Brimstone.fadeTime = cfg.fadeTime ?? 0.3;
        Brimstone.headPrefab = cfg.headPrefab;
        Brimstone.bodyPrefab = cfg.bodyPrefab;
        Brimstone.segmentSize = cfg.segmentSize;
        Brimstone.offsetX = cfg.offset;
        Brimstone.offsetY = cfg.offset;
    }

    private static _restoreBrimstoneState(s: ReturnType<typeof EnemyLaser._saveBrimstoneState>): void {
        Brimstone.laserDuration = s.laserDuration;
        Brimstone.tickRate = s.tickRate;
        Brimstone.fadeTime = s.fadeTime;
        Brimstone.headPrefab = s.headPrefab;
        Brimstone.bodyPrefab = s.bodyPrefab;
        Brimstone.segmentSize = s.segmentSize;
        Brimstone.offsetX = s.offsetX;
        Brimstone.offsetY = s.offsetY;
    }
}
