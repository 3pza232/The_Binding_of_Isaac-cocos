import { _decorator, Node, Prefab, instantiate, RigidBody2D, Collider2D, v2, isValid, tween, Tween } from 'cc';
import { Monster } from './Monster';
import { EnemyBullet } from './EnemyBullet';

const { ccclass, property } = _decorator;

enum JumpState { INITIAL, IDLE, JUMP, PAUSE, ATTACK }

const FOUR_DIRS: [number, number][] = [[0, 1], [0, -1], [-1, 0], [1, 0]];

@ccclass('Monstro')
export class Monstro extends Monster {

    @property({ type: Node, displayName: '精灵节点' })
    spriteNode: Node = null!;

    @property({ type: Prefab, displayName: '子弹预制体' })
    bulletPrefab: Prefab = null!;

    // ── 动画名 ──

    @property({ displayName: '跳跃动画', override: true })
    override walkAnimX = 'Jump';

    @property({ displayName: '跳跃动画(垂直)', override: true })
    override walkAnimY = 'Jump';

    @property({ displayName: '攻击动画(水平)', override: true })
    override atkAnimX = 'Attack';

    @property({ displayName: '攻击动画(垂直)', override: true })
    override atkAnimY = 'Attack';

    @property({ displayName: '死亡动画', override: true })
    override deathAnim = 'Die';

    // ── AI ──

    @property({ displayName: '初始静止延迟(秒)' })
    initialDelay = 1.5;

    @property({ displayName: '追踪范围(半径)' })
    trackRange = 350;

    @property({ displayName: '跳跃时长(秒)' })
    jumpDuration = 0.5;

    @property({ displayName: '单次跳跃最大距离' })
    maxJumpDist = 200;

    @property({ displayName: '停顿时长(秒)' })
    pauseDuration = 1.2;

    @property({ displayName: '闲逛距离' })
    wanderDistance = 200;

    @property({ displayName: '子弹速度' })
    bulletSpeed = 12;

    @property({ displayName: '房间半宽' })
    roomHalfW = 380;

    @property({ displayName: '房间半高' })
    roomHalfH = 230;

    // ── 散射攻击 ──

    @property({ displayName: '攻击距离', override: true })
    override atkRange = 200;

    @property({ displayName: '攻击冷却(秒)', override: true })
    override atkCooldown = 5;

    @property({ displayName: '攻击持续(秒)' })
    atkDuration = 0.6;

    @property({ displayName: '散射最小弹数' })
    atkBulletMin = 10;

    @property({ displayName: '散射最大弹数' })
    atkBulletMax = 15;

    @property({ displayName: '散射角度(±°)' })
    atkScatterAngle = 45;

    // ── 战斗 ──

    @property({ displayName: '最大血量' })
    maxHp = 30;

    @property({ displayName: '受击闪烁时长(秒)' })
    hitFlashDuration = 0.3;

    @property({ displayName: '死亡淡出时长(秒)' })
    deathFadeDuration = 2;

    // ── 基类 getter ──

    protected get _bodyNode(): Node { return this.spriteNode; }
    protected get _headNode(): Node { return this.spriteNode; }
    protected get _trackRange(): number { return this.trackRange; }
    protected get _moveSpeed(): number { return 0; }
    protected get _wanderRatio(): number { return 0; }
    protected get _maxHp(): number { return this.maxHp; }
    protected get _hitFlashDuration(): number { return this.hitFlashDuration; }
    protected get _deathFadeDuration(): number { return this.deathFadeDuration; }

    /** 跳跃中不可被追踪/命中 */
    get isTargetable(): boolean { return this._alive && this._state !== JumpState.JUMP; }

    // ── 状态机 ──

    private _state = JumpState.INITIAL;
    private _stateTimer = 0;
    private _shotThisPause = false;
    private _atkCooldownTimer = 0;

    onEnable(): void {
        super.onEnable();
        Tween.stopAllByTarget(this.spriteNode);
        this.spriteNode.setPosition(0, 0, 0);
        this._state = JumpState.INITIAL;
        this._stateTimer = this.initialDelay;
        this._shotThisPause = false;
        this._atkCooldownTimer = 0;
        this._setColliderEnabled(true);
    }

    update(dt: number): void {
        if (!this._alive) { this._deathUpdate(dt); return; }
        this._flashUpdate(dt);

        this._stateTimer -= dt;
        this._atkCooldownTimer -= dt;

        const mx = this.node.worldPosition.x;
        const my = this.node.worldPosition.y;

        const chasing = isValid(this._player) && (() => {
            const dx = this._player.worldPosition.x - mx;
            const dy = this._player.worldPosition.y - my;
            return Math.sqrt(dx * dx + dy * dy) <= this._trackRange;
        })();

        const inAtkRange = isValid(this._player) && (() => {
            const dx = this._player.worldPosition.x - mx;
            const dy = this._player.worldPosition.y - my;
            return Math.sqrt(dx * dx + dy * dy) <= this.atkRange;
        })();

        switch (this._state) {
            case JumpState.INITIAL:
                this._rigidBody.linearVelocity = v2(0, 0);
                if (this._stateTimer <= 0) {
                    if (inAtkRange && this._atkCooldownTimer <= 0) {
                        this._startAttack();
                    } else {
                        this._startJump(chasing);
                    }
                }
                break;

            case JumpState.IDLE:
                if (inAtkRange && this._atkCooldownTimer <= 0) {
                    this._startAttack();
                } else {
                    this._startJump(chasing);
                }
                break;

            case JumpState.PAUSE:
                this._rigidBody.linearVelocity = v2(0, 0);
                this._anim.stop();
                this._currentAnim = null;
                this._playIdle();

                if (!this._shotThisPause) {
                    this._shotThisPause = true;
                    this._shootFourWay();
                }

                if (this._stateTimer <= 0) {
                    if (inAtkRange && this._atkCooldownTimer <= 0) {
                        this._startAttack();
                    } else {
                        this._startJump(chasing);
                    }
                }
                break;

            case JumpState.JUMP:
                break;

            case JumpState.ATTACK:
                this._rigidBody.linearVelocity = v2(0, 0);
                if (this._stateTimer <= 0) {
                    this._state = JumpState.PAUSE;
                    this._stateTimer = this.pauseDuration;
                    this._shotThisPause = false;
                }
                break;
        }
    }

    // ── 碰撞器 ──

    private _collider: Collider2D | null = null;

    private _setColliderEnabled(on: boolean): void {
        if (!this._collider) {
            this._collider = this.node.getComponent(Collider2D);
        }
        if (this._collider) this._collider.enabled = on;
    }

    // ── 跳跃 ──

    private _getRoomCenter(): { cx: number; cy: number } {
        const roomNode = this.node.parent?.parent;
        if (roomNode) return { cx: roomNode.worldPosition.x, cy: roomNode.worldPosition.y };
        return { cx: this.node.worldPosition.x, cy: this.node.worldPosition.y };
    }

    private _calcTarget(chasing: boolean): { tx: number; ty: number } {
        const mx = this.node.worldPosition.x;
        const my = this.node.worldPosition.y;
        const { cx, cy } = this._getRoomCenter();
        const minX = cx - this.roomHalfW, maxX = cx + this.roomHalfW;
        const minY = cy - this.roomHalfH, maxY = cy + this.roomHalfH;

        let tx: number, ty: number;
        if (chasing) {
            tx = this._player.worldPosition.x;
            ty = this._player.worldPosition.y;
        } else {
            const a = Math.random() * Math.PI * 2;
            tx = mx + Math.cos(a) * this.wanderDistance;
            ty = my + Math.sin(a) * this.wanderDistance;
        }
        let dx = tx - mx, dy = ty - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.maxJumpDist) {
            dx = (dx / dist) * this.maxJumpDist;
            dy = (dy / dist) * this.maxJumpDist;
            tx = mx + dx; ty = my + dy;
        }
        tx = Math.max(minX, Math.min(maxX, tx));
        ty = Math.max(minY, Math.min(maxY, ty));
        return { tx, ty };
    }

    private _startJump(chasing: boolean): void {
        this._state = JumpState.JUMP;
        this._stateTimer = 0;
        this._shotThisPause = false;
        this._setColliderEnabled(false);   // 跳跃中无敌
        this._rigidBody.linearVelocity = v2(0, 0);

        const mx = this.node.worldPosition.x;
        const my = this.node.worldPosition.y;
        const { tx, ty } = this._calcTarget(chasing);
        const tdx = tx - mx, tdy = ty - my;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        this._setFacing(tdx, tdy);
        this._playAnim(this.walkAnimX);

        const sprite = this.spriteNode;
        sprite.setPosition(0, 0, 0);
        const arcH = dist * 0.4;

        tween(sprite)
            .to(this.jumpDuration, {}, {
                onUpdate: (_target: Node, ratio: number) => {
                    sprite.setWorldPosition(
                        mx + tdx * ratio,
                        my + tdy * ratio + arcH * 4 * ratio * (1 - ratio),
                        0,
                    );
                },
            })
            .call(() => {
                sprite.setPosition(0, 0, 0);
                this.node.setWorldPosition(tx, ty, 0);
                this._setColliderEnabled(true);  // 落地恢复
                this._state = JumpState.PAUSE;
                this._stateTimer = this.pauseDuration;
            })
            .start();
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

    // ── 四向子弹 ──

    private _shootFourWay(): void {
        if (!this.bulletPrefab) return;
        const sx = this.node.worldPosition.x;
        const sy = this.node.worldPosition.y;
        for (const [dx, dy] of FOUR_DIRS) this._spawnBullet(dx, dy, sx, sy);
    }

    // ── 散射攻击 ──

    private _startAttack(): void {
        this._state = JumpState.ATTACK;
        this._stateTimer = this.atkDuration;
        this._atkCooldownTimer = this.atkCooldown;
        this._shotThisPause = false;
        this._rigidBody.linearVelocity = v2(0, 0);
        this._playAnim(this.atkAnimX);

        const count = this.atkBulletMin + Math.floor(Math.random() * (this.atkBulletMax - this.atkBulletMin + 1));
        const interval = this.atkDuration / count;
        const dirSign = this._player.worldPosition.x >= this.node.worldPosition.x ? 1 : -1;

        for (let i = 0; i < count; i++) {
            this.scheduleOnce(() => {
                if (!this._alive || this._state !== JumpState.ATTACK) return;
                const a = (Math.random() - 0.5) * 2 * this.atkScatterAngle;
                const rad = a * Math.PI / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                const dx = dirSign * cos;
                const dy = dirSign * sin;
                this._spawnBullet(dx, dy, this.node.worldPosition.x, this.node.worldPosition.y);
            }, i * interval);
        }
    }

    private _spawnBullet(dx: number, dy: number, sx: number, sy: number): void {
        if (!this.bulletPrefab) return;
        const bullet = instantiate(this.bulletPrefab);
        bullet.setParent(this.node.parent!);
        bullet.setWorldPosition(sx, sy, 0);
        const rb = bullet.getComponent(RigidBody2D);
        if (rb) rb.linearVelocity = v2(dx * this.bulletSpeed, dy * this.bulletSpeed);
        const eb = bullet.getComponent(EnemyBullet);
        if (eb) { eb.owner = this.node; eb.launch(); }
    }

    // ── 攻击 = 接触伤害 ──

    protected _doAttack(_dx: number, _dy: number): void { }
    protected _chase(_dx: number, _dy: number): void { }
    protected _idle(_dt: number): void { }
}
