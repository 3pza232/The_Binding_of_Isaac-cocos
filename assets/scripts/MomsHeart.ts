import { _decorator, Node, Prefab, instantiate, RigidBody2D, v2, Color, isValid } from 'cc';
import { Monster } from './Monster';
import { EnemyBullet } from './EnemyBullet';
import { EnemyLaser } from './EnemyLaser';

const { ccclass, property } = _decorator;

const TWO_PI = Math.PI * 2;

enum Pattern { NONE, CIRCULAR, LOCK_ON, FAN, CHAOS, LASER }

/**
 * MomsHeart Boss — 站桩弹幕型 Boss。
 * 5 种攻击模式：圆形弹幕 / 连续锁定 / 扇形波 / 常态单发 / 疯狂乱射。
 */
@ccclass('MomsHeart')
export class MomsHeart extends Monster {

    // ── 节点 ──

    @property({ type: Node, displayName: '精灵节点' })
    spriteNode: Node = null!;

    @property({ type: Prefab, displayName: '子弹预制体' })
    bulletPrefab: Prefab = null!;

    // ── 动画名 ──

    @property({ displayName: '行走动画(水平)', override: true })
    override walkAnimX = '';

    @property({ displayName: '行走动画(垂直)', override: true })
    override walkAnimY = '';

    @property({ displayName: '空闲动画', override: true })
    override idleAnim = '';

    @property({ displayName: '死亡动画(身体)', override: true })
    override deathAnim = '';

    // ── 子弹基础参数 ──

    @property({ displayName: '子弹速度' })
    bulletSpeed = 8;

    @property({ displayName: '子弹射程', range: [50, 600, 10], slide: true })
    bulletRange = 300;

    // ── 攻击 1：圆形弹幕 ──

    @property({ displayName: '圆形弹幕数', range: [8, 36, 1] })
    circularCount = 20;

    @property({ displayName: '圆形弹幕冷却(秒)', range: [3, 30, 0.5], slide: true })
    circularCooldown = 10;

    // ── 攻击 2：连续锁定 ──

    @property({ displayName: '锁定弹数', range: [5, 30, 1] })
    lockonCount = 15;

    @property({ displayName: '锁定间隔(秒)', range: [0.05, 1, 0.05], slide: true })
    lockonInterval = 0.2;

    @property({ displayName: '锁定冷却(秒)', range: [3, 30, 0.5], slide: true })
    lockonCooldown = 8;

    // ── 攻击 3：扇形波 ──

    @property({ displayName: '扇形波数', range: [1, 6, 1] })
    fanWaves = 3;

    @property({ displayName: '波间隔(秒)', range: [0.1, 1, 0.05], slide: true })
    fanWaveInterval = 0.3;

    @property({ displayName: '扇形冷却(秒)', range: [3, 30, 0.5], slide: true })
    fanCooldown = 12;

    // ── 攻击 4：常态单发 ──

    @property({ displayName: '单发间隔(秒)', range: [0.5, 10, 0.5], slide: true })
    normalInterval = 2;

    // ── 攻击 5：疯狂乱射 ──

    @property({ displayName: '乱射持续(秒)', range: [2, 15, 0.5], slide: true })
    chaosDuration = 5;

    @property({ displayName: '乱射间隔(秒)', range: [0.05, 0.5, 0.05], slide: true })
    chaosInterval = 0.12;

    @property({ displayName: '乱射冷却(秒)', range: [5, 60, 1], slide: true })
    chaosCooldown = 20;

    // ── 攻击 6：蓄力激光 ──

    @property({ type: Prefab, displayName: '激光头预制体' })
    laserHeadPrefab: Prefab = null!;

    @property({ type: Prefab, displayName: '激光体预制体' })
    laserBodyPrefab: Prefab = null!;

    @property({ displayName: '激光伤害/跳', range: [0.5, 10, 0.5], slide: true })
    laserDamage = 2;

    @property({ displayName: '激光频率(次/秒)', range: [1, 30, 1] })
    laserTickRate = 4;

    @property({ displayName: '蓄力时长(秒)', range: [1, 5, 0.5], slide: true })
    laserChargeTime = 2.5;

    @property({ displayName: '激光持续(秒)', range: [1, 5, 0.5], slide: true })
    laserDuration = 2.5;

    @property({ displayName: '激光段间距', range: [32, 128, 8] })
    laserSegmentSize = 64;

    @property({ displayName: '激光偏移' })
    laserOffset = 5;

    @property({ displayName: '激光冷却(秒)', range: [5, 30, 1], slide: true })
    laserCooldown = 15;

    // ── 战斗 ──

    @property({ displayName: '最大血量' })
    maxHp = 80;

    @property({ displayName: '受击闪烁时长(秒)' })
    hitFlashDuration = 0.3;

    @property({ displayName: '死亡淡出时长(秒)' })
    deathFadeDuration = 2;

    // ── 基类 getter ──

    protected get _bodyNode(): Node { return this.spriteNode || this.node.getChildByName('Sprite')!; }
    protected get _headNode(): Node { return this.spriteNode || this.node.getChildByName('Sprite')!; }
    protected get _trackRange(): number { return 9999; }
    protected get _moveSpeed(): number { return 0; }
    protected get _wanderRatio(): number { return 0; }
    protected get _maxHp(): number { return this.maxHp; }
    protected get _hitFlashDuration(): number { return this.hitFlashDuration; }
    protected get _deathFadeDuration(): number { return this.deathFadeDuration; }

    // ── 状态机 ──

    private _pattern: Pattern = Pattern.NONE;
    private _cooldowns = new Map<Pattern, number>();
    private _subStep = 0;
    private _subTotal = 0;
    private _subTimer = 0;
    private _normalTimer = 0;
    private _laserSegments: Node[] = [];
    private _laserTickTimer = 0;
    private _laserChargeDone = false;
    private _laserDirX = 0;
    private _laserDirY = 0;
    private _laserPhaseTimer = 0;

    // ── 生命期 ──

    onEnable(): void {
        super.onEnable();
        this._pattern = Pattern.NONE;
        this._subStep = this._subTotal = 0;
        this._subTimer = 0;
        this._normalTimer = 0;
        this._laserChargeDone = false;
        this._cooldowns.clear();
        this._rigidBody.linearVelocity = v2(0, 0);
    }

    onDisable(): void {
        super.onDisable();
        EnemyLaser.cleanup(this._laserSegments);
    }

    update(dt: number): void {
        if (!this._alive) { EnemyLaser.cleanup(this._laserSegments); this._deathUpdate(dt); return; }
        this._flashUpdate(dt);

        this._rigidBody.linearVelocity = v2(0, 0);

        if (!isValid(this._player)) return;

        // 激光模式中屏蔽其他攻击
        const inLaser = this._pattern === Pattern.LASER;

        // 常态单发（激光期间暂停）
        if (!inLaser) {
            this._normalTimer -= dt;
            if (this._normalTimer <= 0) {
                this._normalTimer = this.normalInterval;
                this._fireAtPlayer();
            }
        }

        // 冷却衰减
        for (const [k, v] of this._cooldowns) {
            this._cooldowns.set(k, Math.max(0, v - dt));
        }

        // 执行当前模式
        if (this._pattern !== Pattern.NONE) {
            this._tickPattern(dt);
            return;
        }

        // 选择下一个模式（优先级：激光 > 混乱 > 圆形 > 锁定 > 扇形）
        if (this._cooldownReady(Pattern.LASER, this.laserCooldown)) {
            this._enterPattern(Pattern.LASER);
        } else if (this._cooldownReady(Pattern.CHAOS, this.chaosCooldown)) {
            this._enterPattern(Pattern.CHAOS);
        } else if (this._cooldownReady(Pattern.CIRCULAR, this.circularCooldown)) {
            this._enterPattern(Pattern.CIRCULAR);
        } else if (this._cooldownReady(Pattern.LOCK_ON, this.lockonCooldown)) {
            this._enterPattern(Pattern.LOCK_ON);
        } else if (this._cooldownReady(Pattern.FAN, this.fanCooldown)) {
            this._enterPattern(Pattern.FAN);
        }
    }

    // ── 模式切换 ──

    private _enterPattern(p: Pattern): void {
        this._pattern = p;
        this._subStep = 0;
        this._subTimer = 0;
        switch (p) {
            case Pattern.CIRCULAR:
                this._subTotal = 1;
                break;
            case Pattern.LOCK_ON:
                this._subTotal = this.lockonCount;
                break;
            case Pattern.FAN:
                this._subTotal = this.fanWaves;
                break;
            case Pattern.CHAOS:
                this._subTotal = 1;
                break;
            case Pattern.LASER:
                this._subTotal = 1;
                this._laserChargeDone = false;
                this._laserPhaseTimer = this.laserChargeTime;
                this._bodySprite.color = Color.WHITE.clone();
                // 锁定玩家方向
                const dx = this._player.worldPosition.x - this.node.worldPosition.x;
                const dy = this._player.worldPosition.y - this.node.worldPosition.y;
                const mag = Math.sqrt(dx * dx + dy * dy);
                if (mag > 0) { this._laserDirX = dx / mag; this._laserDirY = dy / mag; }
                else { this._laserDirX = 1; this._laserDirY = 0; }
                break;
        }
        this._tickPattern(0);
    }

    private _tickPattern(dt: number): void {
        this._subTimer -= dt;
        switch (this._pattern) {
            case Pattern.CIRCULAR:
                // 一次性发射
                this._fireCircular();
                this._setCooldown(Pattern.CIRCULAR, this.circularCooldown);
                this._pattern = Pattern.NONE;
                break;

            case Pattern.LOCK_ON:
                if (this._subTimer <= 0 && this._subStep < this._subTotal) {
                    this._subTimer = this.lockonInterval;
                    this._subStep++;
                    this._fireAtPlayer();
                }
                if (this._subStep >= this._subTotal) {
                    this._setCooldown(Pattern.LOCK_ON, this.lockonCooldown);
                    this._pattern = Pattern.NONE;
                }
                break;

            case Pattern.FAN:
                if (this._subTimer <= 0 && this._subStep < this._subTotal) {
                    this._subTimer = this.fanWaveInterval;
                    const bullets = 5 - this._subStep; // 5, 4, 3
                    this._fireFan(bullets);
                    this._subStep++;
                }
                if (this._subStep >= this._subTotal) {
                    this._setCooldown(Pattern.FAN, this.fanCooldown);
                    this._pattern = Pattern.NONE;
                }
                break;

            case Pattern.CHAOS:
                if (this._subTimer <= 0) {
                    this._subTimer = this.chaosInterval;
                    const a = Math.random() * TWO_PI;
                    this._spawnBullet(Math.cos(a), Math.sin(a));
                }
                this._subStep++;
                if (this._subStep * this.chaosInterval >= this.chaosDuration) {
                    this._setCooldown(Pattern.CHAOS, this.chaosCooldown);
                    this._pattern = Pattern.NONE;
                }
                break;

            case Pattern.LASER:
                this._laserTick(dt);
                break;
        }
    }

    // ── 激光阶段 ──

    private _laserTick(dt: number): void {
        this._laserPhaseTimer -= dt;

        // Phase 0: 蓄力
        if (!this._laserChargeDone) {
            const ratio = 1 - Math.max(0, this._laserPhaseTimer) / this.laserChargeTime;
            const gb = Math.round(255 * (1 - ratio));
            this._bodySprite.color = new Color(255, gb, gb, 255);

            if (this._laserPhaseTimer <= 0) {
                this._laserChargeDone = true;
                this._bodySprite.color = Color.WHITE.clone();
                this._laserPhaseTimer = this.laserDuration;
                this._laserTickTimer = 0;
                this._laserSegments = EnemyLaser.fire({
                    worldPos: this.node.worldPosition,
                    dir: v2(this._laserDirX, this._laserDirY),
                    damage: this.laserDamage,
                    headPrefab: this.laserHeadPrefab,
                    bodyPrefab: this.laserBodyPrefab,
                    segmentSize: this.laserSegmentSize,
                    offset: this.laserOffset,
                    laserDuration: this.laserDuration,
                    tickRate: this.laserTickRate,
                    parent: this.node.parent!,
                });
            }
            return;
        }

        // Phase 1: 激光持续
        this._laserTickTimer -= dt;
        if (this._laserTickTimer <= 0) {
            this._laserTickTimer = 1 / this.laserTickRate;
            EnemyLaser.damagePlayers(this._laserSegments, this.node);
        }

        if (this._laserPhaseTimer <= 0) {
            this._bodySprite.color = Color.WHITE.clone();
            EnemyLaser.cleanup(this._laserSegments);
            this._setCooldown(Pattern.LASER, this.laserCooldown);
            this._pattern = Pattern.NONE;
        }
    }

    // ── 发射方法 ──

    /** 朝玩家发射一颗子弹 */
    private _fireAtPlayer(): void {
        const dx = this._player.worldPosition.x - this.node.worldPosition.x;
        const dy = this._player.worldPosition.y - this.node.worldPosition.y;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag <= 0) return;
        this._spawnBullet(dx / mag, dy / mag);
    }

    /** 圆形弹幕 */
    private _fireCircular(): void {
        const step = TWO_PI / this.circularCount;
        for (let i = 0; i < this.circularCount; i++) {
            const a = i * step;
            this._spawnBullet(Math.cos(a), Math.sin(a));
        }
    }

    /** 扇形波（朝玩家方向，bulletCount 颗散布在 ±30° 范围内） */
    private _fireFan(bulletCount: number): void {
        const dx = this._player.worldPosition.x - this.node.worldPosition.x;
        const dy = this._player.worldPosition.y - this.node.worldPosition.y;
        const baseAngle = Math.atan2(dy, dx);
        const spread = 30 * Math.PI / 180; // ±30°

        if (bulletCount <= 1) {
            this._spawnBullet(Math.cos(baseAngle), Math.sin(baseAngle));
            return;
        }
        for (let i = 0; i < bulletCount; i++) {
            const t = bulletCount > 1 ? (i / (bulletCount - 1)) * 2 - 1 : 0; // -1..1
            const a = baseAngle + t * spread;
            this._spawnBullet(Math.cos(a), Math.sin(a));
        }
    }

    /** 生成一颗子弹 */
    private _spawnBullet(dx: number, dy: number): void {
        if (!this.bulletPrefab) return;
        const bullet = instantiate(this.bulletPrefab);
        bullet.setParent(this.node.parent!);
        bullet.setWorldPosition(this.node.worldPosition);
        const rb = bullet.getComponent(RigidBody2D);
        if (rb) rb.linearVelocity = v2(dx * this.bulletSpeed, dy * this.bulletSpeed);
        const eb = bullet.getComponent(EnemyBullet);
        if (eb) {
            eb.owner = this.node;
            eb.range = this.bulletRange;
            eb.launch();
        }
    }

    // ── 冷却管理 ──

    private _cooldownReady(p: Pattern, _cd: number): boolean {
        return (this._cooldowns.get(p) ?? 0) <= 0;
    }

    private _setCooldown(p: Pattern, cd: number): void {
        this._cooldowns.set(p, cd);
    }

    // ── 禁用基类移动/攻击逻辑 ──

    protected _doAttack(_dx: number, _dy: number): void { }
    protected _chase(_dx: number, _dy: number): void { }
    protected _idle(_dt: number): void { }
}
