import {
    _decorator, Component, Node, RigidBody2D, Animation, Sprite,
    Collider2D, Contact2DType, AudioClip, AudioSource, Color, v2,
} from 'cc';

const { ccclass, property } = _decorator;

export type MonsterState = 'idle-stand' | 'idle-wander' | 'chase';

/**
 * 怪物基类。公共逻辑：追踪/闲逛/受击闪烁/死亡淡出。
 * 子类通过 getter 提供参数和节点引用。
 */
@ccclass('Monster')
export abstract class Monster extends Component {

    // ── 属性（基类：仅特效节点，可置空） ──

    @property({ type: Node, displayName: '特效节点(可空)' })
    effectNode: Node | null = null;

    @property({ type: [AudioClip], displayName: '死亡音效(可空)' })
    deathSounds: AudioClip[] = [];

    @property({ displayName: '死亡音量', range: [0, 1, 0.05], slide: true })
    deathVolume = 1;

    // ── 子组件引用 ──

    protected _player: Node = null!;
    protected _anim: Animation = null!;
    protected _bodySprite: Sprite = null!;
    protected _headSprite: Sprite = null!;
    protected _rigidBody: RigidBody2D = null!;
    protected _audioSrc: AudioSource = null!;

    // ── 帧复用缓存 ──

    protected _vel2 = v2(0, 0);                      // 速度向量
    protected _tmpColor = new Color(255, 255, 255, 255); // 颜色

    // ── 状态 ──

    protected _state: MonsterState = 'idle-stand';
    protected _facing: 'right' | 'left' | 'down' | 'up' = 'down';
    protected _currentAnim: string | null = null;
    protected _standTimer = 0;
    protected _wanderTimer = 0;
    protected _wanderDir = v2(0, 0);

    // ── HP / 受击 / 死亡 ──

    protected _hp = 0;
    protected _alive = true;
    protected _flashTimer = 0;
    protected _deathTimer = 0;

    // ── 子类实现的方法 ──

    /** 身体节点（子类 @property 提供） */
    protected abstract get _bodyNode(): Node;
    /** 头部节点（子类 @property 提供） */
    protected abstract get _headNode(): Node;
    protected abstract _playAnimX(): string;
    protected abstract _playAnimY(): string;
    protected abstract _setIdleFrame(): void;
    protected abstract get _trackRange(): number;
    protected abstract get _moveSpeed(): number;
    protected abstract get _wanderRatio(): number;
    protected abstract get _maxHp(): number;
    protected abstract get _hitFlashDuration(): number;
    protected abstract get _deathFadeDuration(): number;

    // ── 公开状态 ──

    /** 是否存活（供 Room 检测清除条件） */
    get alive(): boolean { return this._alive; }

    // ── 生命周期 ──

    onLoad(): void {
        // @property 设了用 property，没设 fallback 到 getChildByName
        const bodyNode = this._bodyNode || this.node.getChildByName('Body')!;
        const headNode = this._headNode || this.node.getChildByName('Head')!;
        const effNode = this.effectNode || this.node.getChildByName('Effect');

        this._anim = bodyNode.getComponent(Animation)!;
        this._bodySprite = bodyNode.getComponent(Sprite)!;
        this._headSprite = headNode.getComponent(Sprite)!;
        this._rigidBody = this.node.getComponent(RigidBody2D)!;
        this.effectNode = effNode;

        // 监听泪弹碰撞
        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onHit, this);
        }

        this._audioSrc = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);

        this._hp = this._maxHp;
        this._setIdleFrame();
    }

    /** 房间每次激活时重新寻找玩家 */
    onEnable(): void {
        if (!this._alive) return;
        // 向上查找到 Room_0* 节点（含 Room 组件），再在其 RoomManager 下找 Isaac
        let roomNode = this.node.parent;
        while (roomNode && !roomNode.getComponent('Room')) {
            roomNode = roomNode.parent;
        }
        if (roomNode) {
            const roomMgr = roomNode.getChildByName('RoomManager');
            this._player = roomMgr?.getChildByName('Isaac') ?? null;
        }
    }

    update(dt: number): void {
        if (!this._alive) {
            this._deathUpdate(dt);
            return;
        }

        // 受击红色闪烁
        this._flashUpdate(dt);

        // 房间未激活或玩家不在本房间时跳过 AI
        if (!this._player) return;

        // AI
        const ppos = this._player.worldPosition;
        const mpos = this.node.worldPosition;
        const dx = ppos.x - mpos.x;
        const dy = ppos.y - mpos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this._trackRange) {
            this._chase(dx, dy);
        } else {
            this._idle(dt);
        }
    }

    // ── 受击 ──

    private _onHit(_self: Collider2D, other: Collider2D): void {
        if (!this._alive) return;
        const tear = other.node.getComponent('Tear') as any;
        if (tear) {
            this._takeDamage(tear.damage ?? 1);
        }
    }

    protected _takeDamage(dmg: number): void {
        this._hp -= dmg;
        this._flashTimer = this._hitFlashDuration;
        if (this._hp <= 0) this._die();
    }

    private _flashUpdate(dt: number): void {
        if (this._flashTimer <= 0) return;
        this._flashTimer -= dt;
        const t = 1 - Math.max(0, this._flashTimer) / this._hitFlashDuration;
        const gb = Math.round(255 * t);
        this._tmpColor.set(255, gb, gb, 255);
        this._bodySprite.color = this._tmpColor;
        this._headSprite.color = this._tmpColor;
        if (this._flashTimer < 0) {
            this._bodySprite.color = Color.WHITE;
            this._headSprite.color = Color.WHITE;
        }
    }

    // ── 死亡 ──

    private _die(): void {
        this._alive = false;
        this._deathTimer = 0;
        this._vel2.set(0, 0);
        this._rigidBody.linearVelocity = this._vel2;
        this._anim.stop();

        // 死亡后彻底脱离物理世界
        const collider = this.node.getComponent(Collider2D);
        if (collider) collider.enabled = false;

        // 播放特效动画
        if (this.effectNode) {
            const ea = this.effectNode.getComponent(Animation);
            if (ea) ea.play('blood_cloud');
        }

        // 随机死亡音效
        if (this.deathSounds.length > 0) {
            const clip = this.deathSounds[Math.floor(Math.random() * this.deathSounds.length)];
            this._audioSrc.playOneShot(clip, this.deathVolume);
        }
    }

    private _deathUpdate(dt: number): void {
        this._deathTimer += dt;
        const t = Math.min(1, this._deathTimer / this._deathFadeDuration);
        const a = Math.round(255 * (1 - t));
        this._tmpColor.set(255, 255, 255, a);
        this._bodySprite.color = this._tmpColor;
        this._headSprite.color = this._tmpColor;

        if (t >= 1) this.node.destroy();
    }

    // ── 追踪 ──

    protected _chase(dx: number, dy: number): void {
        this._state = 'chase';
        const mag = Math.sqrt(dx * dx + dy * dy);
        this._vel2.set((dx / mag) * this._moveSpeed, (dy / mag) * this._moveSpeed);
        this._rigidBody.linearVelocity = this._vel2;

        if (Math.abs(dx) >= Math.abs(dy)) {
            this._facing = dx > 0 ? 'right' : 'left';
            this._bodyNode.setScale(this._facing === 'right' ? 1 : -1, 1, 1);
            this._playAnim(this._playAnimX());
        } else {
            this._facing = dy > 0 ? 'up' : 'down';
            this._bodyNode.setScale(1, 1, 1);
            this._playAnim(this._playAnimY());
        }
    }

    // ── 闲置 / 闲逛 ──

    protected _idle(dt: number): void {
        if (this._state === 'idle-wander') {
            this._wanderTimer -= dt;
            if (this._wanderTimer <= 0) { this._enterStand(); return; }
            this._vel2.set(
                this._wanderDir.x * this._moveSpeed * 0.3,
                this._wanderDir.y * this._moveSpeed * 0.3,
            );
            this._rigidBody.linearVelocity = this._vel2;
            if (Math.abs(this._wanderDir.x) >= Math.abs(this._wanderDir.y)) {
                this._playAnim(this._playAnimX());
            } else {
                this._playAnim(this._playAnimY());
            }
        } else {
            this._standTimer -= dt;
            if (this._standTimer <= 0 && Math.random() < this._wanderRatio) {
                this._enterWander();
            }
        }
    }

    protected _playAnim(name: string): void {
        if (name === this._currentAnim) return;
        this._currentAnim = name;
        this._anim.play(name);
    }

    protected _enterStand(): void {
        this._state = 'idle-stand';
        this._vel2.set(0, 0);
        this._rigidBody.linearVelocity = this._vel2;
        this._anim.stop();
        this._currentAnim = null;
        this._setIdleFrame();
        this._standTimer = 1 + Math.random() * 2;
    }

    protected _enterWander(): void {
        this._state = 'idle-wander';
        const angle = Math.random() * Math.PI * 2;
        this._wanderDir.set(Math.cos(angle), Math.sin(angle));
        if (Math.abs(this._wanderDir.x) >= Math.abs(this._wanderDir.y)) {
            this._facing = this._wanderDir.x > 0 ? 'right' : 'left';
        } else {
            this._facing = this._wanderDir.y > 0 ? 'up' : 'down';
        }
        this._bodyNode.setScale(this._facing === 'left' ? -1 : 1, 1, 1);
        this._wanderTimer = 0.5 + Math.random() * 1.0;
    }
}
