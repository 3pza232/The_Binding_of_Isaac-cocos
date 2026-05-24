import { _decorator, Component, RigidBody2D, Animation, Collider2D, Contact2DType, Vec3, AudioClip, AudioSource } from 'cc';
import { GROUP } from './Constants';
import { PlayerHealth } from './PlayerHealth';

const { ccclass, property } = _decorator;

@ccclass('EnemyBullet')
export class EnemyBullet extends Component {

    @property({ displayName: '射程' })
    range = 250;

    @property({ type: AudioClip, displayName: '发射音效' })
    fireSound: AudioClip | null = null;

    @property({ type: AudioClip, displayName: '破裂音效' })
    breakSound: AudioClip | null = null;

    @property({ displayName: '音效音量', range: [0, 1, 0.05], slide: true })
    sfxVolume = 1;

    /** 发射此子弹的怪物（死亡面板用于获取肖像） */
    owner: Node | null = null;

    private _rigidBody: RigidBody2D = null!;
    private _anim: Animation | null = null;
    private _audioSrc: AudioSource | null = null;
    private _hit = false;
    private _started = false;
    private _startPos = new Vec3();

    onLoad(): void {
        this._rigidBody = this.node.getComponent(RigidBody2D)!;
        this._audioSrc = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);

        const sprite = this.node.getChildByName('Sprite');
        if (sprite) this._anim = sprite.getComponent(Animation);

        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
        }
    }

    /** 由发射方调用，注入飞行方向与速度后开始计程 */
    launch(): void {
        this._started = true;
        this.node.getWorldPosition(this._startPos);
        if (this.fireSound && this._audioSrc) {
            this._audioSrc.playOneShot(this.fireSound, this.sfxVolume);
        }
    }

    update(_dt: number): void {
        if (!this._started || this._hit) return;

        const dx = this.node.worldPosition.x - this._startPos.x;
        const dy = this.node.worldPosition.y - this._startPos.y;
        if (Math.sqrt(dx * dx + dy * dy) >= this.range) {
            this._break();
        }
    }

    private _onContact(_self: Collider2D, other: Collider2D): void {
        if (this._hit) return;

        // 墙 → 破裂
        if (other.group === GROUP.WALL) {
            this._break();
            return;
        }

        // 玩家 → 伤害 + 破裂
        if (other.group === GROUP.PLAYER) {
            const ph = other.node.getComponent(PlayerHealth);
            if (ph && ph.alive && !ph.isInvulnerable) {
                ph.takeHit(this.owner || this.node);
            }
            this._break();
        }
    }

    private _break(): void {
        if (this._hit) return;
        this._hit = true;

        if (this.breakSound && this._audioSrc) {
            this._audioSrc.playOneShot(this.breakSound, this.sfxVolume);
        }

        this.scheduleOnce(() => {
            if (this._rigidBody && this._rigidBody.isValid) {
                this._rigidBody.enabled = false;
            }
            if (this._anim) this._anim.play('blood_tear_break');
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) this.node.destroy();
            }, 1);
        }, 0);
    }
}
