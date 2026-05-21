import {
    _decorator, Component, Node, Collider2D, Contact2DType,
    AudioClip, AudioSource, tween, v3,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ItemBase')
export abstract class ItemBase extends Component {

    @property({ type: AudioClip, displayName: '拾取音效' })
    pickupSound: AudioClip | null = null;

    @property({ displayName: '音效音量', range: [0, 1, 0.05], slide: true })
    sfxVolume = 1;

    // ── 浮动动画 ──

    @property({ displayName: '浮动高度(px)' })
    floatAmplitude = 5;

    @property({ displayName: '浮动周期(秒)' })
    floatPeriod = 1.5;

    // ── 鼓动动画 ──

    @property({ displayName: '鼓动强度' })
    pulseStrength = 0.06;

    @property({ displayName: '鼓动周期(秒)' })
    pulsePeriod = 0.8;

    onLoad(): void {
        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.sensor = true;
            collider.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
        }

        this._startFloat();
        this._startPulse();
    }

    private _startFloat(): void {
        if (this.floatAmplitude <= 0) return;
        const up = v3(0, this.floatAmplitude, 0);
        const down = v3(0, -this.floatAmplitude, 0);
        tween(this.node)
            .by(this.floatPeriod / 2, { position: up }, { easing: 'sineInOut' })
            .by(this.floatPeriod / 2, { position: down }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    private _startPulse(): void {
        if (this.pulseStrength <= 0) return;
        const s = 1 + this.pulseStrength;
        tween(this.node)
            .to(this.pulsePeriod / 2, { scale: v3(s, s, 1) }, { easing: 'sineInOut' })
            .to(this.pulsePeriod / 2, { scale: v3(1, 1, 1) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    // ── 拾取 ──

    private _onContact(_self: Collider2D, other: Collider2D): void {
        if (other.group !== 4) return;

        const collider = this.node.getComponent(Collider2D);
        if (collider) collider.enabled = false;

        this.onPickup(other.node);

        if (this.pickupSound) {
            const src = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
            src.playOneShot(this.pickupSound, this.sfxVolume);
        }

        this.node.active = false;
        this.scheduleOnce(() => this.node.destroy(), 0);
    }

    protected abstract onPickup(player: Node): void;
}
