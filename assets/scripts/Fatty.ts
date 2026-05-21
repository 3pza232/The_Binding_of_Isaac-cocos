import { _decorator, Node } from 'cc';
import { Monster } from './Monster';

const { ccclass, property } = _decorator;

@ccclass('Fatty')
export class Fatty extends Monster {

    @property({ type: Node, displayName: '身体节点' })
    bodyNode: Node = null!;

    @property({ type: Node, displayName: '头部节点' })
    headNode: Node = null!;

    // ── 动画名 ──

    @property({ displayName: '行走动画(水平)', override: true })
    override walkAnimX = 'fatty_body_x';

    @property({ displayName: '行走动画(垂直)', override: true })
    override walkAnimY = 'fatty_body_y';

    @property({ displayName: '死亡动画(特效)', override: true })
    override deathEffectAnim = 'blood_cloud';

    @property({ displayName: '攻击动画(身体X)', override: true })
    override atkAnimX = 'fatty_attack_x';

    @property({ displayName: '攻击动画(身体Y)', override: true })
    override atkAnimY = 'fatty_attack_y';

    @property({ displayName: '攻击动画(特效)', override: true })
    override atkEffectAnim = 'soot_bomb';

    // ── 攻击参数 ──

    @property({ displayName: '攻击距离(0=同追踪距)', override: true })
    override atkRange = 60;

    @property({ displayName: '攻击间隔(秒,0=禁用)', override: true })
    override atkCooldown = 2;

    @property({ displayName: '攻击推力' })
    atkPushForce = 250;

    // ── AI 参数 ──

    @property({ displayName: '追踪范围(半径)' })
    trackRange = 150;

    @property({ displayName: '移动速度' })
    moveSpeed = 3;

    @property({ displayName: '闲逛概率', range: [0, 1, 0.05], slide: true })
    wanderRatio = 0.3;

    // ── 战斗参数 ──

    @property({ displayName: '最大血量' })
    maxHp = 6;

    @property({ displayName: '受击闪烁时长(秒)' })
    hitFlashDuration = 0.5;

    @property({ displayName: '死亡淡出时长(秒)' })
    deathFadeDuration = 1.5;

    // ── 基类 getter ──

    protected get _bodyNode(): Node { return this.bodyNode; }
    protected get _headNode(): Node { return this.headNode; }
    protected get _trackRange(): number { return this.trackRange; }
    protected get _moveSpeed(): number { return this.moveSpeed; }
    protected get _wanderRatio(): number { return this.wanderRatio; }
    protected get _maxHp(): number { return this.maxHp; }
    protected get _hitFlashDuration(): number { return this.hitFlashDuration; }
    protected get _deathFadeDuration(): number { return this.deathFadeDuration; }

    // ── 攻击：靠近玩家时喷烟推人 ──

    protected _doAttack(dx: number, dy: number): void {
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag <= 0) return;
        const health = this._player.getComponent('PlayerHealth') as any;
        if (health?.applyPush) {
            health.applyPush(
                (dx / mag) * this.atkPushForce,
                (dy / mag) * this.atkPushForce,
            );
        }
    }
}
