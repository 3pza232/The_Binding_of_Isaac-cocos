import { sys, KeyCode } from 'cc';
import {
    DEFAULT_MAX_HP, DEFAULT_MOVE_SPEED, DEFAULT_TEAR_DAMAGE,
    DEFAULT_TEAR_SPEED, DEFAULT_RANGE, DEFAULT_FIRE_RATE, DEFAULT_KEYS,
} from './Constants';

// ── 存档数据结构 ──

export interface PlayerStatsData {
    hp: number;
    maxHp: number;
    moveSpeed: number;
    tearDamage: number;
    damageMul: number;
    range: number;
    tearSpeed: number;
    fireRate: number;
    homingEnabled: boolean;
    keys: number;
    coins: number;
}

export interface RoomSaveData {
    key: string;
    x: number;
    y: number;
    type: number;
    cleared: boolean;
    itemTaken: boolean;
    links: string[];
    doorsUnlocked: boolean[];
}

export interface SaveData {
    scene: string;
    playerRoom: string;
    stats: PlayerStatsData;
    rooms: RoomSaveData[];
    collectedPool: string[];
    uiItemNames: string[];
    bossIntroShown: string[];
}

// ── 单例 ──

export class GameState {

    private static _i: GameState;
    /** 快捷访问 GameState.i */
    static get i(): GameState {
        if (!GameState._i) GameState._i = new GameState();
        return GameState._i;
    }

    // ── 玩家状态 ──

    hp = DEFAULT_MAX_HP;
    maxHp = DEFAULT_MAX_HP;
    moveSpeed = DEFAULT_MOVE_SPEED;

    // ── 泪弹参数 ──

    tearDamage = DEFAULT_TEAR_DAMAGE;
    damageMul = 1;
    range = DEFAULT_RANGE;
    tearSpeed = DEFAULT_TEAR_SPEED;
    fireRate = DEFAULT_FIRE_RATE;
    homing = false;

    // ── 资源 ──

    keys = DEFAULT_KEYS;
    coins = 0;

    // ── 藏品池 ──

    collected = new Set<string>();

    // ── Boss 入场已展示房间（grid key）──

    bossIntroDone = new Set<string>();

    // ── 输入状态（跨传送持久）──

    heldMoveKeys = new Set<KeyCode>();
    heldAimKeys = new Map<KeyCode, number>();

    // ── 菜单 → 游戏过渡标记 ──

    shouldContinue = false;

    // ── 存档 ──

    private static readonly SAVE_KEY = 'isaac_save';

    static get hasSave(): boolean {
        return sys.localStorage.getItem(GameState.SAVE_KEY) !== null;
    }

    save(data: SaveData): void {
        sys.localStorage.setItem(GameState.SAVE_KEY, JSON.stringify(data));
    }

    load(): SaveData | null {
        const raw = sys.localStorage.getItem(GameState.SAVE_KEY);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw) as SaveData;
            if (!data.scene || !data.rooms) return null;
            return data;
        } catch {
            return null;
        }
    }

    deleteSave(): void {
        sys.localStorage.removeItem(GameState.SAVE_KEY);
    }

    // ── 重置（新游戏）──

    reset(): void {
        this.hp = this.maxHp = DEFAULT_MAX_HP;
        this.moveSpeed = DEFAULT_MOVE_SPEED;
        this.tearDamage = DEFAULT_TEAR_DAMAGE;
        this.damageMul = 1;
        this.range = DEFAULT_RANGE;
        this.tearSpeed = DEFAULT_TEAR_SPEED;
        this.fireRate = DEFAULT_FIRE_RATE;
        this.homing = false;
        this.keys = DEFAULT_KEYS;
        this.coins = 0;
        this.collected.clear();
        this.bossIntroDone.clear();
        this.heldMoveKeys.clear();
        this.heldAimKeys.clear();
    }

    /** 从存档恢复玩家属性 */
    restoreStats(s: PlayerStatsData): void {
        this.hp = s.hp;
        this.maxHp = s.maxHp;
        this.moveSpeed = s.moveSpeed;
        this.tearDamage = s.tearDamage;
        this.damageMul = s.damageMul;
        this.range = s.range;
        this.tearSpeed = s.tearSpeed;
        this.fireRate = s.fireRate;
        this.homing = s.homingEnabled;
        this.keys = s.keys;
        this.coins = s.coins;
    }

    // ── 便捷方法 ──

    get alive(): boolean { return this.hp > 0; }

    takeDamage(n = 1): void { this.hp = Math.max(0, this.hp - n); }
    heal(n: number): void { this.hp = Math.min(this.hp + n, this.maxHp); }
    setMaxHp(n: number): void { this.maxHp = Math.min(n, 16); }

    spendKey(n = 1): boolean { if (this.keys < n) return false; this.keys -= n; return true; }
    addKeys(n: number): void { this.keys += n; }
    spendCoin(n: number): boolean { if (this.coins < n) return false; this.coins -= n; return true; }
    addCoins(n: number): void { this.coins += n; }

    markCollected(name: string): void { this.collected.add(name); }
    isCollected(name: string): boolean { return this.collected.has(name); }
}
