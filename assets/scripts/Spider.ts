import { _decorator, Node, v2, isValid } from 'cc';
import { Monster } from './Monster';

const { ccclass, property } = _decorator;

enum SpiderState { IDLE, WALK, PAUSE }

@ccclass('Spider')
export class Spider extends Monster {

    @property({ type: Node, displayName: '精灵节点' })
    spriteNode: Node = null!;

    // ── 动画名 ──

    @property({ displayName: '行走动画', override: true })
    override walkAnimX = 'Walk';

    @property({ displayName: '行走动画(垂直)', override: true })
    override walkAnimY = 'Walk';

    @property({ displayName: '死亡动画', override: true })
    override deathAnim = 'Die';

    // ── AI 参数 ──

    @property({ displayName: '追踪范围(半径)' })
    trackRange = 250;

    @property({ displayName: '移动速度' })
    moveSpeed = 2;

    @property({ displayName: '行走时长(秒)' })
    walkDuration = 0.5;

    @property({ displayName: '停顿时长(秒)' })
    pauseDuration = 1;

    @property({ displayName: '闲逛距离' })
    wanderDistance = 150;

    // ── 战斗参数 ──

    @property({ displayName: '最大血量' })
    maxHp = 6;

    @property({ displayName: '受击闪烁时长(秒)' })
    hitFlashDuration = 0.3;

    @property({ displayName: '死亡淡出时长(秒)' })
    deathFadeDuration = 1.5;

    // ── 基类 getter ──

    protected get _bodyNode(): Node { return this.spriteNode; }
    protected get _headNode(): Node { return this.spriteNode; }
    protected get _trackRange(): number { return this.trackRange; }
    protected get _moveSpeed(): number { return this.moveSpeed; }
    protected get _wanderRatio(): number { return 0; }
    protected get _maxHp(): number { return this.maxHp; }
    protected get _hitFlashDuration(): number { return this.hitFlashDuration; }
    protected get _deathFadeDuration(): number { return this.deathFadeDuration; }

    // ── 状态机 ──

    private _state = SpiderState.IDLE;
    private _stateTimer = 0;
    private _targetPos = v2(0, 0);

    update(dt: number): void {
        if (!this._alive) { this._deathUpdate(dt); return; }
        this._flashUpdate(dt);

        this._stateTimer -= dt;

        const mx = this.node.worldPosition.x;
        const my = this.node.worldPosition.y;

        // 确定目标
        const chasing = isValid(this._player) && (() => {
            const dx = this._player.worldPosition.x - mx;
            const dy = this._player.worldPosition.y - my;
            return Math.sqrt(dx * dx + dy * dy) <= this._trackRange;
        })();

        switch (this._state) {
            case SpiderState.IDLE:
                // 进入行走：追踪时朝玩家，闲逛时随机方向
                this._state = SpiderState.WALK;
                this._stateTimer = this.walkDuration;

                if (chasing) {
                    this._targetPos.set(
                        this._player.worldPosition.x,
                        this._player.worldPosition.y,
                    );
                } else {
                    const a = Math.random() * Math.PI * 2;
                    this._targetPos.set(
                        mx + Math.cos(a) * this.wanderDistance,
                        my + Math.sin(a) * this.wanderDistance,
                    );
                }
                this._setFacing(this._targetPos.x - mx, this._targetPos.y - my);
                this._playAnim(this.walkAnimX);
                break;

            case SpiderState.PAUSE:
                this._rigidBody.linearVelocity = v2(0, 0);
                this._anim.stop();
                this._currentAnim = null;
                this._playIdle();

                if (this._stateTimer <= 0) {
                    this._state = SpiderState.WALK;
                    this._stateTimer = this.walkDuration;

                    if (chasing) {
                        this._targetPos.set(
                            this._player.worldPosition.x,
                            this._player.worldPosition.y,
                        );
                    } else {
                        const a = Math.random() * Math.PI * 2;
                        this._targetPos.set(
                            mx + Math.cos(a) * this.wanderDistance,
                            my + Math.sin(a) * this.wanderDistance,
                        );
                    }
                    this._setFacing(this._targetPos.x - mx, this._targetPos.y - my);
                    this._playAnim(this.walkAnimX);
                }
                break;

            case SpiderState.WALK: {
                const tdx = this._targetPos.x - mx;
                const tdy = this._targetPos.y - my;
                const rem = Math.sqrt(tdx * tdx + tdy * tdy);

                if (rem < 4 || this._stateTimer <= 0) {
                    this._state = SpiderState.PAUSE;
                    this._stateTimer = this.pauseDuration;
                } else {
                    this._rigidBody.linearVelocity = v2(
                        (tdx / rem) * this._moveSpeed,
                        (tdy / rem) * this._moveSpeed,
                    );
                }
                break;
            }
        }
    }

    private _setFacing(dx: number, dy: number): void {
        if (Math.abs(dx) >= Math.abs(dy)) {
            this._facing = dx > 0 ? 'right' : 'left';
            this._bodyNode.setScale(this._facing === 'right' ? 1 : -1, 1, 1);
        } else {
            this._facing = dy > 0 ? 'up' : 'down';
            this._bodyNode.setScale(1, 1, 1);
        }
    }

    // ── 攻击 = 接触伤害 ──

    protected _doAttack(_dx: number, _dy: number): void { }
    protected _chase(_dx: number, _dy: number): void { }
    protected _idle(_dt: number): void { }
}
