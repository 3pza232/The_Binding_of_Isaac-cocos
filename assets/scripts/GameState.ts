import { sys, KeyCode, Prefab, SpriteFrame, Node, Vec2, v2 } from "cc";
import {
    DEFAULT_MAX_HP,
    DEFAULT_MOVE_SPEED,
    DEFAULT_TEAR_DAMAGE,
    DEFAULT_TEAR_SPEED,
    DEFAULT_RANGE,
    DEFAULT_FIRE_RATE,
    DEFAULT_KEYS,
    MAX_KEYS,
    MAX_COINS,
    AttackType,
} from "./Constants";
import { EffectPipeline } from "./EffectPipeline";
import { LaserTracker } from "./LaserTracker";

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
    laserHomingEnabled: boolean;
    enemyPiercing: boolean;
    wallPiercing: boolean;
    brimstone: boolean;
    dollarBill: boolean;
    keys: number;
    coins: number;
}

export interface DropSaveData {
    type: 'coin' | 'key';
    x: number;
    y: number;
    amount: number;
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
    collectiblePrefabNames: string[];
    drops: DropSaveData[];
}

export interface SaveData {
    scene: string;
    playerRoom: string;
    playerRoomX: number;
    playerRoomY: number;
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
    laserHoming = false; // 激光追踪（SacredHeart 等藏品）
    tearHomingStrength = 8; // 泪弹追踪转向速度(越大越快)
    laserTrackingStrength = 1.0; // 激光追踪强度倍率(SacredHeart/SpoonBender 等设置)
    enemyPiercing = false;
    wallPiercing = false;
    tearSf: SpriteFrame | null = null;

    attackType = AttackType.NORMAL;
    brimstone = false;
    brimCharge = 0;
    brimState = 0;
    brimCharged = false;
    brimFired = false;
    brimLaserTimer = 0;
    dollarBill = false;

    // ── 资源 ──

    keys = DEFAULT_KEYS;
    coins = 0;

    // ── 藏品池 ──

    collected = new Set<string>();

    // ── Boss 入场已展示房间（grid key）──

    bossIntroDone = new Set<string>();

    // ── 玩家在房间内的坐标（存档用）──

    playerRoomX = 0;
    playerRoomY = 0;

    // ── 输入状态（跨传送持久）──

    heldMoveKeys = new Set<KeyCode>();
    heldAimKeys = new Map<KeyCode, number>();

    // ── 移动端触控桥梁（← Joystick/DirectionButton 写入 → Body/Head 读取）──

    mobileMoveDir = v2(0, 0);
    mobileAimDir: Vec2 | null = null;
    mobileFireDir: Vec2 | null = null;

    // ── 藏品池（跨关卡共享）──

    /** 由 MenuController 在开始新游戏时注入 */
    static collectiblePrefabs: Prefab[] = [];

    // ── 菜单 → 游戏过渡标记 ──

    shouldContinue = false;

    /** 场景过渡标记：SceneDoor → 下一层，跳过 reset 保留玩家状态 */
    sceneTransitioning = false;

    /** 跨场景持久 BGM 节点（Start→Menu 无缝衔接） */
    static persistBgmNode: Node | null = null;

    // ── 通用持续效果回调（藏品可注册帧更新）──

    private _effects: Array<(dt: number) => void> = [];

    onFrame(fn: (dt: number) => void): void {
        this._effects.push(fn);
    }
    tickEffects(dt: number): void {
        for (const fn of this._effects) fn(dt);
    }
    clearEffects(): void {
        this._effects = [];
    }

    // ── 存档 ──

    private static readonly SAVE_KEY = "isaac_save";

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
        this.laserHoming = false;
        this.tearHomingStrength = 8;
        this.laserTrackingStrength = 1.0;
        this.enemyPiercing = false;
        this.wallPiercing = false;
        this.tearSf = null;
        this.dollarBill = false;
        this.brimstone = false;
        this.attackType = AttackType.NORMAL;
        this.brimCharge = 0;
        this.brimState = 0;
        this.brimCharged = false;
        this.brimFired = false;
        this.brimLaserTimer = 0;
        this.clearEffects();
        EffectPipeline.clear();
        LaserTracker.clearBendModifiers();
        this.keys = DEFAULT_KEYS;
        this.coins = 0;
        this.playerRoomX = 0;
        this.playerRoomY = 0;
        this.collected.clear();
        this.bossIntroDone.clear();
        this.heldMoveKeys.clear();
        this.heldAimKeys.clear();
        this.mobileMoveDir.set(0, 0);
        this.mobileAimDir = null;
        this.mobileFireDir = null;
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
        this.laserHoming = s.laserHomingEnabled;
        this.enemyPiercing = s.enemyPiercing;
        this.wallPiercing = s.wallPiercing;
        this.brimstone = s.brimstone;
        this.attackType = s.brimstone ? AttackType.BRIMSTONE : AttackType.NORMAL;
        this.dollarBill = s.dollarBill;
        this.keys = s.keys;
        this.coins = s.coins;
    }

    // ── 便捷方法 ──

    get alive(): boolean {
        return this.hp > 0;
    }

    takeDamage(n = 1): void {
        this.hp = Math.max(0, this.hp - n);
    }
    heal(n: number): void {
        this.hp = Math.min(this.hp + n, this.maxHp);
    }
    setMaxHp(n: number): void {
        this.maxHp = Math.min(n, 16);
    }

    spendKey(n = 1): boolean {
        if (this.keys < n) return false;
        this.keys -= n;
        return true;
    }
    addKeys(n: number): void {
        this.keys = Math.min(this.keys + n, MAX_KEYS);
    }
    spendCoin(n: number): boolean {
        if (this.coins < n) return false;
        this.coins -= n;
        return true;
    }
    addCoins(n: number): void {
        this.coins = Math.min(this.coins + n, MAX_COINS);
    }

    markCollected(name: string): void {
        this.collected.add(name);
    }
    isCollected(name: string): boolean {
        return this.collected.has(name);
    }
}
