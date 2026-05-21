import {
    _decorator, Component, Node, RigidBody2D, Animation, Sprite, SpriteFrame,
    Collider2D, Contact2DType, AudioClip, AudioSource, Color, v2, isValid,
} from 'cc';

const { ccclass, property } = _decorator;

export type MonsterState = 'idle-stand' | 'idle-wander' | 'chase';

/**
 * 怪物基类 — 公共 AI + 表现层。
 * 动画名 / 音效数组 / 特效节点均为 @property，编辑器直接拖入配置。
 * 子类通过 override property 设默认值 + getter 提供参数/节点引用。
 * 音效播放默认随机取，子类可覆写 _onHurtSfx / _onDeathSfx / _onAtkSfx。
 */
@ccclass('Monster')
export abstract class Monster extends Component {

    // ── 特效节点 ──

    @property({ type: [Node], displayName: '特效节点', tooltip: '0=死亡,1+=攻击/自定义...' })
    effectNodes: Node[] = [];

    // ── 动画名 ──

    @property({ displayName: '行走动画(水平)' })
    walkAnimX = '';

    @property({ displayName: '行走动画(垂直)' })
    walkAnimY = '';

    @property({ displayName: '空闲动画(空=用帧)' })
    idleAnim = '';

    @property({ displayName: '死亡动画(身体)' })
    deathAnim = '';

    @property({ displayName: '死亡动画(特效)' })
    deathEffectAnim = '';

    @property({ displayName: '攻击动画(身体X)' })
    atkAnimX = '';

    @property({ displayName: '攻击动画(身体Y)' })
    atkAnimY = '';

    @property({ displayName: '攻击动画(头部X)' })
    atkHeadAnimX = '';

    @property({ displayName: '攻击动画(头部Y)' })
    atkHeadAnimY = '';

    @property({ displayName: '攻击动画(特效)' })
    atkEffectAnim = '';

    // ── 攻击参数 ──

    @property({ displayName: '攻击距离(0=同追踪距)' })
    atkRange = 0;

    @property({ displayName: '攻击间隔(秒,0=禁用)' })
    atkCooldown = 0;

    @property({ displayName: '起手定身(秒)' })
    atkFreeze = 0;

    // ── 空闲帧（idleAnim 为空时用）──

    @property({ type: SpriteFrame, displayName: '水平空闲帧' })
    idleHorizontal: SpriteFrame | null = null;

    @property({ type: SpriteFrame, displayName: '垂直空闲帧' })
    idleVertical: SpriteFrame | null = null;

    // ── 音效 ──

    @property({ type: [AudioClip], displayName: '受伤音效' })
    hurtSounds: AudioClip[] = [];

    @property({ type: [AudioClip], displayName: '死亡音效' })
    deathSounds: AudioClip[] = [];

    @property({ type: [AudioClip], displayName: '攻击音效' })
    atkSounds: AudioClip[] = [];

    @property({ displayName: '音效音量', range: [0, 1, 0.05], slide: true })
    sfxVolume = 1;

    // ── 子组件引用 ──

    protected _player: Node = null!;
    protected _anim: Animation = null!;
    protected _bodySprite: Sprite = null!;
    protected _headSprite: Sprite = null!;
    protected _rigidBody: RigidBody2D = null!;
    protected _audioSrc: AudioSource = null!;

    // ── 帧复用缓存 ──

    protected _vel2 = v2(0, 0);
    protected _tmpColor = new Color(255, 255, 255, 255);

    // ── 状态 ──

    protected _state: MonsterState = 'idle-stand';
    protected _facing: 'right' | 'left' | 'down' | 'up' = 'down';
    protected _currentAnim: string | null = null;
    protected _standTimer = 0;
    protected _wanderTimer = 0;
    protected _atkTimer = 0;
    protected _wanderDir = v2(0, 0);

    // ── HP / 受击 / 死亡 ──

    protected _hp = 0;
    protected _alive = true;
    protected _flashTimer = 0;
    protected _deathTimer = 0;

    // ── 子类实现 ──

    protected abstract get _bodyNode(): Node;
    protected abstract get _headNode(): Node;
    protected abstract get _trackRange(): number;
    protected abstract get _moveSpeed(): number;
    protected abstract get _wanderRatio(): number;
    protected abstract get _maxHp(): number;
    protected abstract get _hitFlashDuration(): number;
    protected abstract get _deathFadeDuration(): number;

    // ── 公开状态 ──

    get alive(): boolean { return this._alive; }

    // ── 生命周期 ──

    onLoad(): void {
        const bodyNode = this._bodyNode || this.node.getChildByName('Body')!;
        const headNode = this._headNode || this.node.getChildByName('Head')!;

        if (!this.effectNodes[0]) {
            const fx = this.node.getChildByName('Effect');
            if (fx) this.effectNodes[0] = fx;
        }

        this._anim = bodyNode.getComponent(Animation)!;
        this._bodySprite = bodyNode.getComponent(Sprite)!;
        this._headSprite = headNode.getComponent(Sprite)!;
        this._rigidBody = this.node.getComponent(RigidBody2D)!;

        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onHit, this);
        }

        this._audioSrc = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
        this._hp = this._maxHp;
        this._playIdle();
    }

    onEnable(): void {
        if (!this._alive) return;
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
        if (!this._alive) { this._deathUpdate(dt); return; }
        this._flashUpdate(dt);
        if (!isValid(this._player)) return;

        const ppos = this._player.worldPosition;
        const mpos = this.node.worldPosition;
        const dx = ppos.x - mpos.x;
        const dy = ppos.y - mpos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this._trackRange) {
            this._chase(dx, dy);
            this._tryAttack(dx, dy, dist, dt);
        } else {
            this._idle(dt);
            this._atkTimer = 0;
        }
    }

    // ── 受击 ──

    private _onHit(_self: Collider2D, other: Collider2D): void {
        if (!this._alive) return;
        const tear = other.node.getComponent('Tear') as any;
        if (tear) {
            this._takeDamage(tear.damage ?? 1);
            this._onHurtSfx();
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

        const collider = this.node.getComponent(Collider2D);
        if (collider) collider.enabled = false;

        if (this.deathAnim) this._anim.play(this.deathAnim);
        this.playEffect(0, this.deathEffectAnim);
        this._onDeathSfx();
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
            this._playAnim(this.walkAnimX);
        } else {
            this._facing = dy > 0 ? 'up' : 'down';
            this._bodyNode.setScale(1, 1, 1);
            this._playAnim(this.walkAnimY);
        }
    }

    // ── 攻击 ──

    private _tryAttack(dx: number, dy: number, dist: number, dt: number): void {
        if (this.atkCooldown <= 0) return; // 未配攻击
        this._atkTimer -= dt;
        if (this._atkTimer > 0) return;

        const atkRange = this.atkRange > 0 ? this.atkRange : this._trackRange * 0.5;
        if (dist > atkRange) return;

        this._atkTimer = this.atkCooldown;

        // 攻击动画：身体（走 _playAnim 以跟踪状态，恢复时自动切回走动）
        const useX = Math.abs(dx) >= Math.abs(dy);
        const bodyAnim = useX ? this.atkAnimX || this.atkAnimY : this.atkAnimY || this.atkAnimX;
        if (bodyAnim) this._playAnim(bodyAnim);
        // 攻击动画：头部
        const headAnimName = useX ? this.atkHeadAnimX || this.atkHeadAnimY : this.atkHeadAnimY || this.atkHeadAnimX;
        if (headAnimName) {
            const headAnimComp = this._headNode.getComponent(Animation);
            if (headAnimComp) headAnimComp.play(headAnimName);
        }
        // 攻击特效（优先 index 1，无则用 0）
        if (this.atkEffectAnim) {
            const effIdx = this.effectNodes.length > 1 && this.effectNodes[1] ? 1 : 0;
            this.playEffect(effIdx, this.atkEffectAnim);
        }

        // 起手定身
        if (this.atkFreeze > 0) {
            this._vel2.set(0, 0);
            this._rigidBody.linearVelocity = this._vel2;
            this.scheduleOnce(() => { this._currentAnim = null; }, this.atkFreeze);
        }

        this._onAtkSfx();
        this._doAttack(dx, dy);
    }

    /** 攻击行为 — 子类覆写（吐弹/冲撞/召唤等） */
    protected _doAttack(_dx: number, _dy: number): void { }

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
                this._playAnim(this.walkAnimX);
            } else {
                this._playAnim(this.walkAnimY);
            }
        } else {
            this._standTimer -= dt;
            if (this._standTimer <= 0 && Math.random() < this._wanderRatio) {
                this._enterWander();
            }
        }
    }

    protected _playAnim(name: string): void {
        if (!name || name === this._currentAnim) return;
        this._currentAnim = name;
        this._anim.play(name);
    }

    protected _enterStand(): void {
        this._state = 'idle-stand';
        this._vel2.set(0, 0);
        this._rigidBody.linearVelocity = this._vel2;
        this._anim.stop();
        this._currentAnim = null;
        this._playIdle();
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

    // ── 空闲 ──

    private _playIdle(): void {
        if (this.idleAnim) {
            this._currentAnim = this.idleAnim;
            this._anim.play(this.idleAnim);
        } else {
            const isH = this._facing === 'right' || this._facing === 'left';
            const sf = isH ? this.idleHorizontal : this.idleVertical;
            if (sf) this._bodySprite.spriteFrame = sf;
        }
    }

    // ── 特效工具 ──

    /** 在 effectNodes[idx] 上播放动画 */
    protected playEffect(idx: number, animName: string): void {
        if (!animName) return;
        const node = idx < this.effectNodes.length ? this.effectNodes[idx] : null;
        if (node) {
            const anim = node.getComponent(Animation);
            if (anim) anim.play(animName);
        }
    }

    // ── 音效（默认随机取，子类可覆写）──

    /** 随机播放 clips 中一个音效 */
    protected playRandomSnd(clips: AudioClip[], volume: number = this.sfxVolume): void {
        const valid = clips.filter(c => c);
        if (valid.length > 0) {
            const clip = valid[Math.floor(Math.random() * valid.length)];
            this._audioSrc?.playOneShot(clip, volume);
        }
    }

    /** 受击音效 — 子类可覆写为顺序/条件播放等 */
    protected _onHurtSfx(): void {
        this.playRandomSnd(this.hurtSounds, this.sfxVolume);
    }

    /** 死亡音效 — 子类可覆写 */
    protected _onDeathSfx(): void {
        this.playRandomSnd(this.deathSounds, this.sfxVolume);
    }

    /** 攻击音效 — 子类可覆写 */
    protected _onAtkSfx(): void {
        this.playRandomSnd(this.atkSounds, this.sfxVolume);
    }
}
