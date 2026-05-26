import { _decorator, Node, Prefab, v2, Color } from 'cc';
import { Monster } from './Monster';
import { EnemyLaser } from './EnemyLaser';

const { ccclass, property } = _decorator;

enum State { IDLE, CHARGING, FIRING }

type FiringDir = 'right' | 'left' | 'up' | 'down';

const DIR_VEC: Record<FiringDir, [number, number]> = {
    right: [1, 0], left: [-1, 0], up: [0, 1], down: [0, -1],
};

/**
 * Doublevis — 可四向发射激光束的小怪。
 * 追踪玩家靠近后蓄力 → 朝玩家方向发射激光 → 冷却。
 * 激光发射通过 EnemyLaser 模块实现，可被任何敌人复用。
 */
@ccclass('Doublevis')
export class Doublevis extends Monster {

    // ── 节点 / 预制体 ──

    @property({ type: Node, displayName: '精灵节点' })
    spriteNode: Node = null!;

    @property({ type: Prefab, displayName: '激光头预制体' })
    laserHeadPrefab: Prefab = null!;

    @property({ type: Prefab, displayName: '激光体预制体' })
    laserBodyPrefab: Prefab = null!;

    // ── 动画名 ──

    @property({ displayName: '移动动画', override: true })
    override walkAnimX = 'move';

    @property({ displayName: '移动动画(垂直)', override: true })
    override walkAnimY = 'move';

    @property({ displayName: '水平攻击动画', override: true })
    override atkAnimX = 'atk_x';

    @property({ displayName: '向上攻击动画' })
    atkAnimYUp = 'atk_y_up';

    @property({ displayName: '向下攻击动画' })
    atkAnimYDown = 'atk_y_down';

    @property({ displayName: '死亡动画', override: true })
    override deathAnim = '';

    // ── 激光参数 ──

    @property({ displayName: '激光伤害/跳', range: [0.5, 10, 0.5], slide: true })
    laserDamage = 2;

    @property({ displayName: '伤害频率(次/秒)', range: [1, 30, 1] })
    laserTickRate = 4;

    @property({ displayName: '蓄力时长(秒)', range: [0.5, 5, 0.5], slide: true })
    chargeTime = 2;

    @property({ displayName: '激光持续(秒)', range: [0.5, 5, 0.5], slide: true })
    laserDuration = 2;

    @property({ displayName: '攻击冷却(秒)', range: [1, 15, 0.5], slide: true })
    attackCooldown = 4;

    @property({ displayName: '触发攻击距离', range: [50, 500, 10] })
    attackTriggerDist = 250;

    @property({ displayName: '激光段间距', range: [32, 128, 8] })
    segmentSize = 64;

    @property({ displayName: '激光偏移' })
    laserOffset = 5;

    // ── 追踪参数 ──

    @property({ displayName: '追踪范围(半径)' })
    trackRange = 350;

    @property({ displayName: '移动速度' })
    moveSpeed = 2;

    @property({ displayName: '闲逛概率', range: [0, 1, 0.05], slide: true })
    wanderRatio = 0.2;

    // ── 战斗参数 ──

    @property({ displayName: '最大血量' })
    maxHp = 15;

    @property({ displayName: '受击闪烁时长(秒)' })
    hitFlashDuration = 0.3;

    @property({ displayName: '死亡淡出时长(秒)' })
    deathFadeDuration = 1.5;

    // ── 基类 getter ──

    protected get _bodyNode(): Node { return this.spriteNode || this.node.getChildByName('Sprite')!; }
    protected get _headNode(): Node { return this.spriteNode || this.node.getChildByName('Sprite')!; }
    protected get _trackRange(): number { return this.trackRange; }
    protected get _moveSpeed(): number { return this.moveSpeed; }
    protected get _wanderRatio(): number { return this.wanderRatio; }
    protected get _maxHp(): number { return this.maxHp; }
    protected get _hitFlashDuration(): number { return this.hitFlashDuration; }
    protected get _deathFadeDuration(): number { return this.deathFadeDuration; }

    // ── 状态机 ──

    private _state = State.IDLE;
    private _stateTimer = 0;
    private _cooldownTimer = 0;
    private _firingDir: FiringDir = 'right';
    private _laserSegments: Node[] = [];
    private _chargeDone = false;
    private _laserTickTimer = 0;

    // ── 生命期 ──

    onEnable(): void {
        super.onEnable();
        this._state = State.IDLE;
        this._stateTimer = 0;
        this._cooldownTimer = 0;
        this._chargeDone = false;
        this._rigidBody.linearVelocity = v2(0, 0);
    }

    onDisable(): void {
        super.onDisable();
        EnemyLaser.cleanup(this._laserSegments);
    }

    update(dt: number): void {
        if (!this._alive) { EnemyLaser.cleanup(this._laserSegments); this._deathUpdate(dt); return; }
        this._flashUpdate(dt);

        this._cooldownTimer = Math.max(0, this._cooldownTimer - dt);

        switch (this._state) {
            case State.IDLE:   this._idleUpdate(dt);   break;
            case State.CHARGING: this._chargingUpdate(dt); break;
            case State.FIRING: this._firingUpdate(dt);  break;
        }
    }

    // ── IDLE：追踪玩家 / 闲逛 ──

    private _idleUpdate(dt: number): void {
        if (this._player && this._player.isValid) {
            const dx = this._player.worldPosition.x - this.node.worldPosition.x;
            const dy = this._player.worldPosition.y - this.node.worldPosition.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= this._trackRange) {
                if (dist > 50) super._chase(dx, dy);
                else this._rigidBody.linearVelocity = v2(0, 0);

                if (dist <= this.attackTriggerDist && this._cooldownTimer <= 0) {
                    this._startCharge(dx, dy);
                    return;
                }
            } else {
                super._idle(dt);
            }
        } else {
            super._idle(dt);
        }
    }

    // ── CHARGING：蓄力 ──

    private _startCharge(dx: number, dy: number): void {
        this._state = State.CHARGING;
        this._stateTimer = this.chargeTime;
        this._chargeDone = false;
        this._rigidBody.linearVelocity = v2(0, 0);
        this._bodySprite.color = Color.WHITE.clone();

        this._firingDir = Math.abs(dx) >= Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'up' : 'down');

        this._playChargeAnim();
    }

    private _chargingUpdate(dt: number): void {
        this._rigidBody.linearVelocity = v2(0, 0);
        this._stateTimer -= dt;

        const ratio = 1 - Math.max(0, this._stateTimer) / this.chargeTime;
        const gb = Math.round(255 * (1 - ratio));
        this._bodySprite.color = new Color(255, gb, gb, 255);

        if (this._stateTimer <= 0 && !this._chargeDone) {
            this._chargeDone = true;
            this._bodySprite.color = Color.WHITE.clone();
            this._fire();
        }
    }

    // ── FIRING：激光持续 ──

    private _fire(): void {
        this._state = State.FIRING;
        this._stateTimer = this.laserDuration;
        this._laserTickTimer = 0;
        const [dx, dy] = DIR_VEC[this._firingDir];
        this._laserSegments = EnemyLaser.fire({
            worldPos: this.node.worldPosition,
            dir: v2(dx, dy),
            damage: this.laserDamage,
            headPrefab: this.laserHeadPrefab,
            bodyPrefab: this.laserBodyPrefab,
            segmentSize: this.segmentSize,
            offset: this.laserOffset,
            laserDuration: this.laserDuration,
            tickRate: this.laserTickRate,
            parent: this.node.parent!,
        });
    }

    private _firingUpdate(dt: number): void {
        this._rigidBody.linearVelocity = v2(0, 0);
        this._stateTimer -= dt;

        this._laserTickTimer -= dt;
        if (this._laserTickTimer <= 0) {
            this._laserTickTimer = 1 / this.laserTickRate;
            EnemyLaser.damagePlayers(this._laserSegments, this.node);
        }

        if (this._stateTimer <= 0) {
            this._state = State.IDLE;
            this._cooldownTimer = this.attackCooldown;
            this._bodySprite.color = Color.WHITE.clone();
            EnemyLaser.cleanup(this._laserSegments);
        }
    }

    // ── 动画 ──

    private _playChargeAnim(): void {
        switch (this._firingDir) {
            case 'right':
                this._bodyNode.setScale(1, 1, 1);
                this._playAnim(this.atkAnimX);
                break;
            case 'left':
                this._bodyNode.setScale(-1, 1, 1);
                this._playAnim(this.atkAnimX);
                break;
            case 'up':
                this._bodyNode.setScale(1, 1, 1);
                this._playAnim(this.atkAnimYUp);
                break;
            case 'down':
                this._bodyNode.setScale(1, 1, 1);
                this._playAnim(this.atkAnimYDown);
                break;
        }
    }

    protected _doAttack(_dx: number, _dy: number): void { }
}
