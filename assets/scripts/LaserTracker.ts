import { Node, Vec3, Vec2, v3, v2 } from 'cc';

const _v3 = v3();
void _v3;

/** 激光追踪配置 — 藏品可 registerModifier 修改 */
export interface LaserTrackConfig {
    searchRange: number;       // 每段搜索半径(px)
    searchConeDeg: number;     // 搜索锥半角(°)
    steerStrength: number;     // 转向速度(0~1, 越大越快)
    recoveryStrength: number;  // 回正速度(0~1)
    hitCooldown: number;       // 同怪再次对当前段生效的冷却(秒)
}

const DEFAULT: LaserTrackConfig = {
    searchRange: 150,
    searchConeDeg: 45,
    steerStrength: 0.08,
    recoveryStrength: 0.05,
    hitCooldown: 0.4,
};

export type LaserBendModifier = (segIdx: number, cfg: LaserTrackConfig) => LaserTrackConfig;

/**
 * 激光追踪器 — 每段独立搜索敌人并输出偏转方向。
 * 藏品通过 registerBendModifier 注册修饰器，逐段叠加。
 */
export class LaserTracker {
    private _cfg: LaserTrackConfig;
    private _elapsed = 0;
    private _segLastHit = new Map<number, number>(); // segIndex → last hit elapsed

    // 每段偏转修饰器链（藏品注册）
    private static _bendMods: LaserBendModifier[] = [];

    static registerBendModifier(fn: LaserBendModifier): void { this._bendMods.push(fn); }
    static clearBendModifiers(): void { this._bendMods.length = 0; }

    constructor(cfg: Partial<LaserTrackConfig> = {}) {
        this._cfg = { ...DEFAULT, ...cfg };
    }

    reset(): void {
        this._elapsed = 0;
        this._segLastHit.clear();
    }

    tick(dt: number): void { this._elapsed += dt; }

    /** 在某段预期位置附近搜索未冷却敌人，返回目标世界坐标或 null */
    search(segIdx: number, segPos: Vec3, segDir: Vec2, room: Node, forceDir?: Vec2): Vec3 | null {
        const cfg = this._effectiveCfg(segIdx);
        let best: Vec3 | null = null;
        let bestD2 = Infinity;

        // 优先使用强制方向（上一段已经偏转，优先保持连贯）
        const refDir = forceDir ?? segDir;

        room.walk((n) => {
            const m = n.getComponent('Monster') as any;
            if (!m || !m.alive || !m.isTargetable) return;

            const dx = n.worldPosition.x - segPos.x;
            const dy = n.worldPosition.y - segPos.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > cfg.searchRange * cfg.searchRange) return;

            // 锥形检查
            if (d2 > 0.01) {
                const dist = Math.sqrt(d2);
                const dot = (dx / dist) * refDir.x + (dy / dist) * refDir.y;
                const coneCos = Math.cos(cfg.searchConeDeg * Math.PI / 180);
                if (dot < coneCos) return;
            }

            if (d2 < bestD2) { bestD2 = d2; best = n.worldPosition; }
        });

        return best;
    }

    /** 朝向目标偏转方向 */
    steer(curDir: Vec2, targetPos: Vec3, segPos: Vec3, segIdx: number, dt: number): Vec2 {
        const cfg = this._effectiveCfg(segIdx);
        const tx = targetPos.x - segPos.x;
        const ty = targetPos.y - segPos.y;
        const mag = Math.sqrt(tx * tx + ty * ty);
        if (mag <= 0) return curDir;

        const t = Math.min(cfg.steerStrength * dt * 60, 1); // dt×60 归一化到 ~1/frame
        const nx = curDir.x + ((tx / mag) - curDir.x) * t;
        const ny = curDir.y + ((ty / mag) - curDir.y) * t;
        const nm = Math.sqrt(nx * nx + ny * ny);
        if (nm <= 0) return curDir;
        return v2(nx / nm, ny / nm);
    }

    /** 无目标时缓慢回正到基准方向 */
    recover(curDir: Vec2, baseDir: Vec2, segIdx: number, dt: number): Vec2 {
        const cfg = this._effectiveCfg(segIdx);
        const t = Math.min(cfg.recoveryStrength * dt * 60, 1);
        const nx = curDir.x + (baseDir.x - curDir.x) * t;
        const ny = curDir.y + (baseDir.y - curDir.y) * t;
        const nm = Math.sqrt(nx * nx + ny * ny);
        if (nm <= 0) return baseDir.clone();
        return v2(nx / nm, ny / nm);
    }

    /** 记录某段"击中了"（段当前位置同时有敌人在碰撞框内），回到游戏时间 */
    markHit(segIdx: number): void {
        this._segLastHit.set(segIdx, this._elapsed);
    }

    /** 某段是否在冷却中（刚击中过敌人，暂时不追新目标） */
    private _effectiveCfg(segIdx: number): LaserTrackConfig {
        // 应用藏品修饰器链
        let cfg = { ...this._cfg };
        for (const fn of LaserTracker._bendMods) cfg = fn(segIdx, cfg);
        return cfg;
    }
}
