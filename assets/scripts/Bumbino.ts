import { _decorator, Node, v2 } from 'cc';
import { Monster } from './Monster';

const { ccclass, property } = _decorator;

@ccclass('Bumbino')
export class Bumbino extends Monster {

    @property({ type: Node, displayName: '精灵节点' })
    spriteNode: Node = null!;

    // ── 动画名 ──

    @property({ displayName: '行走动画(水平)', override: true })
    override walkAnimX = 'Bumbino_Walk';

    @property({ displayName: '行走动画(垂直)', override: true })
    override walkAnimY = 'Bumbino_Walk';

    @property({ displayName: '空闲动画(空=用帧)', override: true })
    override idleAnim = 'Bumbino_Idle';

    @property({ displayName: '死亡动画(身体)', override: true })
    override deathAnim = 'Bumbino_Defeated';

    @property({ displayName: '攻击动画(身体X)', override: true })
    override atkAnimX = 'Bumbino_Attack';

    @property({ displayName: '攻击动画(身体Y)', override: true })
    override atkAnimY = 'Bumbino_Attack';

    // ── 攻击参数 ──

    @property({ displayName: '攻击距离(0=同追踪距)', override: true })
    override atkRange = 120;

    @property({ displayName: '攻击间隔(秒,0=禁用)', override: true })
    override atkCooldown = 3;

    @property({ displayName: '冲刺速度倍率' })
    chargeSpeedMul = 4;

    @property({ displayName: '冲刺时长(秒)' })
    chargeDuration = 0.5;

    // ── AI 参数 ──

    @property({ displayName: '追踪范围(半径)' })
    trackRange = 350;

    @property({ displayName: '移动速度' })
    moveSpeed = 1.5;

    @property({ displayName: '闲逛概率', range: [0, 1, 0.05], slide: true })
    wanderRatio = 0.2;

    // ── 战斗参数 ──

    @property({ displayName: '最大血量' })
    maxHp = 50;

    @property({ displayName: '受击闪烁时长(秒)' })
    hitFlashDuration = 0.3;

    @property({ displayName: '死亡淡出时长(秒)' })
    deathFadeDuration = 2.0;

    // ── 冲刺状态 ──

    private _charging = false;

    // ── 基类 getter ──

    private get _sprite(): Node {
        return this.spriteNode || this.node.getChildByName('Sprite')!;
    }

    protected get _bodyNode(): Node { return this._sprite; }
    protected get _headNode(): Node { return this._sprite; }
    protected get _trackRange(): number { return this.trackRange; }
    protected get _moveSpeed(): number { return this.moveSpeed; }
    protected get _wanderRatio(): number { return this.wanderRatio; }
    protected get _maxHp(): number { return this.maxHp; }
    protected get _hitFlashDuration(): number { return this.hitFlashDuration; }
    protected get _deathFadeDuration(): number { return this.deathFadeDuration; }

    // ── 攻击：直线冲刺 ──

    protected _doAttack(dx: number, dy: number): void {
        this._charging = true;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 0) {
            this._rigidBody.linearVelocity = v2(
                (dx / mag) * this._moveSpeed * this.chargeSpeedMul,
                (dy / mag) * this._moveSpeed * this.chargeSpeedMul,
            );
        }
        this.scheduleOnce(() => {
            this._charging = false;
            if (this._alive) this._rigidBody.linearVelocity = v2(0, 0);
        }, this.chargeDuration);
    }

    // ── 冲刺期间禁止追移覆盖 ──

    protected _chase(dx: number, dy: number): void {
        if (this._charging) return;
        super._chase(dx, dy);
    }
}
