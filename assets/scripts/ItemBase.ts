import {
    _decorator, Component, Node, Collider2D, Contact2DType,
    AudioClip, AudioSource, tween, v3, Sprite, find,
} from 'cc';
import { CollectibleUI } from './CollectibleUI';
import { GameState } from './GameState';
import { GROUP } from './Constants';

const { ccclass, property } = _decorator;

@ccclass('ItemBase')
export abstract class ItemBase extends Component {

    @property({ type: AudioClip, displayName: '拾取音效' })
    pickupSound: AudioClip | null = null;

    @property({ displayName: '音效音量', range: [0, 1, 0.05], slide: true })
    sfxVolume = 1;

    @property({ displayName: '浮动高度(px)' })
    floatAmplitude = 5;

    @property({ displayName: '浮动周期(秒)' })
    floatPeriod = 1.5;

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

    private _pickedUp = false;

    private _onContact(_self: Collider2D, other: Collider2D): void {
        if (other.group !== GROUP.PLAYER || this._pickedUp) return;
        this._pickedUp = true;

        this.onPickup(other.node);

        const displaySprite = this.getComponent(Sprite);
        if (displaySprite && displaySprite.spriteFrame) {
            const cui = find('Canvas-UI/Collectible_UI')?.getComponent(CollectibleUI);
            cui?.addCollectible(displaySprite.spriteFrame, this.node.name);
        }

        GameState.i.markCollected(this.node.name);

        let roomNode = this.node.parent;
        while (roomNode) {
            const room = roomNode.getComponent('Room') as any;
            if (room?.markItemTaken) { room.markItemTaken(); break; }
            roomNode = roomNode.parent;
        }

        if (this.pickupSound) {
            const src = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
            src.playOneShot(this.pickupSound, this.sfxVolume);
        }

        this.scheduleOnce(() => {
            const collider = this.node.getComponent(Collider2D);
            if (collider) collider.enabled = false;
            this.node.active = false;
            this.node.destroy();
        });
    }

    protected abstract onPickup(player: Node): void;
}
