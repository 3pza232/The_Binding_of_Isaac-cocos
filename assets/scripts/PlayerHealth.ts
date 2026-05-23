import {
    _decorator, Component, Node, Animation, Sprite, SpriteFrame,
    AudioClip, AudioSource, Collider2D, Contact2DType,
    RigidBody2D, UIOpacity, tween, v2, v3, Color, find,
} from 'cc';
import { GameState } from './GameState';
import { GROUP } from './Constants';

const { ccclass, property } = _decorator;

@ccclass('PlayerHealth')
export class PlayerHealth extends Component {

    @property({ displayName: '最大血量' })
    maxHp = 6;

    @property({ displayName: '无敌帧(秒)' })
    invulnDuration = 1.0;

    @property({ displayName: '受击硬直(秒)' })
    stunDuration = 0.5;

    @property({ type: [AudioClip], displayName: '受击音效' })
    hurtSounds: AudioClip[] = [];

    @property({ type: [AudioClip], displayName: '死亡音效' })
    deathSounds: AudioClip[] = [];

    @property({ displayName: '音效音量', range: [0, 1, 0.05], slide: true })
    sfxVolume = 1;

    // ── 实例状态 ──

    private _alive = true;
    private _invulnTimer = 0;
    private _stunTimer = 0;
    private _pushTimer = 0;
    private _flickerTimer = 0;
    private _deathTimer = 0;

    private _bodyNode: Node = null!;
    private _headNode: Node = null!;
    private _bodyAnim: Animation = null!;
    private _bodySprite: Sprite = null!;
    private _headSprite: Sprite = null!;
    private _rigidBody: RigidBody2D = null!;
    private _audioSrc: AudioSource = null!;
    private _idleH: SpriteFrame | null = null;
    private _idleV: SpriteFrame | null = null;
    private _killerNode: Node | null = null;

    get alive(): boolean { return this._alive; }
    get isStunned(): boolean { return this._stunTimer > 0 || this._pushTimer > 0; }
    get isInvulnerable(): boolean { return this._invulnTimer > 0; }

    // ── 生命周期 ──

    onLoad(): void {
        const gs = GameState.i;
        if (gs.hp <= 0) {
            gs.hp = this.maxHp;
            gs.maxHp = this.maxHp;
        }

        this._bodyNode = this.node.getChildByName('Body')!;
        this._headNode = this.node.getChildByName('Head')!;
        this._bodyAnim = this._bodyNode.getComponent(Animation)!;
        this._bodySprite = this._bodyNode.getComponent(Sprite)!;
        this._headSprite = this._headNode.getComponent(Sprite)!;
        this._rigidBody = this.node.getComponent(RigidBody2D)!;
        this._audioSrc = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
        this._rigidBody.enabledContactListener = true;

        const body = this.node.getComponent('Body') as any;
        if (body) {
            this._idleH = body.idleHorizontal ?? null;
            this._idleV = body.idleVertical ?? null;
        }

        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
        }

        if (gs.hp <= 0) {
            this._alive = false;
            this._headNode.active = false;
        }
    }

    update(dt: number): void {
        if (!this._alive) return;

        if (this._stunTimer > 0) {
            this._stunTimer -= dt;
            if (this._stunTimer <= 0) {
                this._headNode.active = true;
                this._bodyAnim.stop();
                this._setBodyIdleFrame();
            }
        }

        if (this._invulnTimer > 0) {
            this._invulnTimer -= dt;
            this._flickerTimer += dt;
            if (this._flickerTimer >= 0.08) {
                this._flickerTimer = 0;
                const a = this._bodySprite.color.a > 128 ? 60 : 255;
                this._bodySprite.color = new Color(255, 255, 255, a);
                this._headSprite.color = new Color(255, 255, 255, a);
            }
            if (this._invulnTimer <= 0) {
                this._bodySprite.color = Color.WHITE;
                this._headSprite.color = Color.WHITE;
            }
        }

        if (this._pushTimer > 0) {
            this._pushTimer -= dt;
            if (this._pushTimer <= 0) {
                this._rigidBody.linearVelocity = v2(0, 0);
            }
        }
    }

    applyPush(vx: number, vy: number, duration = 0.15): void {
        this._rigidBody.linearVelocity = v2(vx, vy);
        this._pushTimer = duration;
    }

    // ── 碰撞 ──

    private _onContact(_self: Collider2D, other: Collider2D): void {
        if (!this._alive || this._invulnTimer > 0) return;
        if (other.group !== GROUP.MONSTER) return;

        const monster = other.node.getComponent('Monster') as any;
        if (!monster || !monster.alive) return;

        this._killerNode = other.node;
        this._takeDamage();
    }

    private _takeDamage(): void {
        GameState.i.takeDamage(1);
        this._invulnTimer = this.invulnDuration;
        this._stunTimer = this.stunDuration;
        this._flickerTimer = 0;

        this._bodyAnim.play('isaac_body_hit');
        this._headNode.active = false;

        if (this.hurtSounds.length > 0) {
            const clip = this.hurtSounds[Math.floor(Math.random() * this.hurtSounds.length)];
            this._audioSrc.playOneShot(clip, this.sfxVolume);
        }

        if (!GameState.i.alive) this._die();
    }

    private _setBodyIdleFrame(): void {
        const body = this.node.getComponent('Body') as any;
        if (!body) return;

        const facing: string = body.facing ?? 'down';
        const sf = facing === 'right' || facing === 'left' ? this._idleH : this._idleV;
        if (sf) this._bodySprite.spriteFrame = sf;
        body.resetAnim();
    }

    // ── 死亡 ──

    private _die(): void {
        this._alive = false;
        this._headNode.active = false;
        this._bodyAnim.play('isaac_body_hit');

        if (this.deathSounds.length > 0) {
            const clip = this.deathSounds[Math.floor(Math.random() * this.deathSounds.length)];
            this._audioSrc.playOneShot(clip, this.sfxVolume);
        }

        const collider = this.node.getComponent(Collider2D);
        if (collider) collider.enabled = false;

        const killer = this._killerNode;

        this.scheduleOnce(() => {
            this._rigidBody.enabled = false;
            this._rigidBody.linearVelocity = v2(0, 0);

            const opacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
            opacity.opacity = 255;
            const startX = this.node.position.x;

            tween(this.node)
                .by(1.5, { position: v3(0, 120, 0) }, {
                    easing: 'sineInOut',
                    onUpdate: (_target: Node, r: number) => {
                        const p = this.node.position;
                        this.node.setPosition(startX + Math.sin(r * Math.PI * 3) * 30, p.y, 0);
                    },
                })
                .start();

            tween(opacity)
                .to(1.5, { opacity: 0 })
                .call(() => this.node.destroy())
                .start();
        });

        setTimeout(() => {
            const canvasUI = find('Canvas-UI');
            if (canvasUI) {
                const ds = canvasUI.getComponent('DeathScreen') as any;
                if (ds) ds.show(killer);
            }
        }, 2000);
    }
}
