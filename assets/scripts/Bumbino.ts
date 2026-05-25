import { _decorator, Node, Color, v2, isValid, AudioClip } from "cc";
import { Monster } from "./Monster";

const { ccclass, property } = _decorator;

enum Atk2State {
    IDLE,
    WINDUP,
}

@ccclass("Bumbino")
export class Bumbino extends Monster {
    @property({ type: Node, displayName: "精灵节点" })
    spriteNode: Node = null!;

    // ── 动画名 ──

    @property({ displayName: "行走动画(水平)", override: true })
    override walkAnimX = "Bumbino_Walk";

    @property({ displayName: "行走动画(垂直)", override: true })
    override walkAnimY = "Bumbino_Walk";

    @property({ displayName: "空闲动画(空=用帧)", override: true })
    override idleAnim = "Bumbino_Idle";

    @property({ displayName: "死亡动画(身体)", override: true })
    override deathAnim = "Bumbino_Defeated";

    @property({ displayName: "冲刺攻击动画(身体X)", override: true })
    override atkAnimX = "Bumbino_Attack";

    @property({ displayName: "冲刺攻击动画(身体Y)", override: true })
    override atkAnimY = "Bumbino_Attack";

    // ── 攻击 1：冲刺 ──

    @property({ displayName: "冲刺距离(0=同追踪距)", override: true })
    override atkRange = 120;

    @property({ displayName: "冲刺间隔(秒,0=禁用)", override: true })
    override atkCooldown = 3;

    @property({ displayName: "冲刺速度倍率" })
    chargeSpeedMul = 4;

    @property({ displayName: "冲刺时长(秒)" })
    chargeDuration = 0.5;

    // ── 攻击 2：范围震地 ──

    @property({ displayName: "震地触发距离" })
    atk2Range = 150;

    @property({ displayName: "震地前摇(秒)" })
    atk2WindUp = 2;

    @property({ displayName: "震地冷却(秒)" })
    atk2Cooldown = 8;

    @property({ displayName: "震地伤害半径" })
    atk2Radius = 150;

    @property({ displayName: "震地动画(水平)" })
    atk2AnimX = "Bumbino_Attack_02";

    @property({ displayName: "震地动画(垂直)" })
    atk2AnimY = "Bumbino_Attack_02";

    @property({ displayName: "震地特效节点索引" })
    atk2EffectIdx = 1;

    @property({ type: AudioClip, displayName: '震地音效' })
    slamSound: AudioClip | null = null;

    // ── AI 参数 ──

    @property({ displayName: "追踪范围(半径)" })
    trackRange = 350;

    @property({ displayName: "移动速度" })
    moveSpeed = 1.5;

    @property({ displayName: "闲逛概率", range: [0, 1, 0.05], slide: true })
    wanderRatio = 0.2;

    // ── 战斗参数 ──

    @property({ displayName: "最大血量" })
    maxHp = 50;

    @property({ displayName: "受击闪烁时长(秒)" })
    hitFlashDuration = 0.3;

    @property({ displayName: "死亡淡出时长(秒)" })
    deathFadeDuration = 2.0;

    // ── 冲刺状态 ──

    private _charging = false;

    // ── 震地状态 ──

    private _atk2State = Atk2State.IDLE;
    private _atk2Timer = 0;
    private _atk2CooldownTimer = 0;

    // ── 基类 getter ──

    private get _sprite(): Node {
        return this.spriteNode || this.node.getChildByName("Sprite")!;
    }

    protected get _bodyNode(): Node {
        return this._sprite;
    }
    protected get _headNode(): Node {
        return this._sprite;
    }
    protected get _trackRange(): number {
        return this.trackRange;
    }
    protected get _moveSpeed(): number {
        return this.moveSpeed;
    }
    protected get _wanderRatio(): number {
        return this.wanderRatio;
    }
    protected get _maxHp(): number {
        return this.maxHp;
    }
    protected get _hitFlashDuration(): number {
        return this.hitFlashDuration;
    }
    protected get _deathFadeDuration(): number {
        return this.deathFadeDuration;
    }

    // ── 生命期 ──

    update(dt: number): void {
        if (!this._alive) {
            this._deathUpdate(dt);
            return;
        }
        this._flashUpdate(dt);
        if (!isValid(this._player)) return;

        this._atk2CooldownTimer -= dt;

        // 震地前摇中
        if (this._atk2State === Atk2State.WINDUP) {
            this._atk2Timer -= dt;
            this._rigidBody.linearVelocity = v2(0, 0);
            this._atk2WindUpFlash();
            if (this._atk2Timer <= 0) {
                this._executeAtk2();
            }
            return;
        }

        const dx = this._player.worldPosition.x - this.node.worldPosition.x;
        const dy = this._player.worldPosition.y - this.node.worldPosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 震地触发检查
        if (dist <= this.atk2Range && this._atk2CooldownTimer <= 0) {
            this._startAtk2();
            return;
        }

        // 正常追踪 / 冲刺
        if (dist <= this._trackRange) {
            this._chase(dx, dy);
            this._tryAttack(dx, dy, dist, dt);
        } else {
            this._idle(dt);
            this._atkTimer = 0;
        }
    }

    // ── 攻击 1：直线冲刺 ──

    protected _doAttack(dx: number, dy: number): void {
        this._charging = true;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 0) {
            this._rigidBody.linearVelocity = v2(
                (dx / mag) * this._moveSpeed * this.chargeSpeedMul,
                (dy / mag) * this._moveSpeed * this.chargeSpeedMul
            );
        }
        this.scheduleOnce(() => {
            this._charging = false;
            if (this._alive) this._rigidBody.linearVelocity = v2(0, 0);
        }, this.chargeDuration);
    }

    protected _chase(dx: number, dy: number): void {
        if (this._charging) return;
        super._chase(dx, dy);
    }

    // ── 攻击 2：范围震地 ──

    private _startAtk2(): void {
        this._atk2State = Atk2State.WINDUP;
        this._atk2Timer = this.atk2WindUp;
        this._rigidBody.linearVelocity = v2(0, 0);
        this._anim.stop();

        // 播前摇动画
        const dx = this._player.worldPosition.x - this.node.worldPosition.x;
        const useX =
            Math.abs(dx) >= Math.abs(this._player.worldPosition.y - this.node.worldPosition.y);
        const anim = useX ? this.atk2AnimX : this.atk2AnimY;
        if (anim) this._anim.play(anim);
    }

    private _atk2WindUpFlash(): void {
        const ratio = 1 - this._atk2Timer / this.atk2WindUp;
        const gb = Math.round(255 * (1 - ratio));
        const c = new Color(255, gb, gb, 255);
        this._bodySprite.color = c;
    }

    private _executeAtk2(): void {
        this._atk2State = Atk2State.IDLE;
        this._atk2CooldownTimer = this.atk2Cooldown;

        // 恢复颜色 + 停止动画
        this._bodySprite.color = Color.WHITE;
        this._anim.stop();
        this._currentAnim = null;
        this._playIdle();

        // 特效
        const idx = this.atk2EffectIdx;
        if (idx < this.effectNodes.length && this.effectNodes[idx]) {
            this.playEffect(idx, "soot_bomb");
        }

        // 震地音效
        if (this.slamSound) {
            this._audioSrc?.playOneShot(this.slamSound, this.sfxVolume);
        }

        // 范围伤害
        const dx = this._player.worldPosition.x - this.node.worldPosition.x;
        const dy = this._player.worldPosition.y - this.node.worldPosition.y;
        if (Math.sqrt(dx * dx + dy * dy) <= this.atk2Radius) {
            const ph = this._player.getComponent("PlayerHealth") as any;
            if (ph && ph.alive) ph.takeHit(this.node);
        }
    }
}
