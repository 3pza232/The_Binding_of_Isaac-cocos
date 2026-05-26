import { _decorator, Component, Collider2D, Contact2DType, AudioClip, AudioSource, Enum } from 'cc';
import { GameState } from './GameState';
import { GROUP } from './Constants';

const { ccclass, property } = _decorator;

export enum DropType { COIN, KEY }

@ccclass('DropPickup')
export class DropPickup extends Component {

    @property({ type: Enum(DropType), displayName: '类型' })
    type: DropType = DropType.COIN;

    @property({ displayName: '数量' })
    amount = 1;

    @property({ type: AudioClip, displayName: '拾取音效' })
    pickupSound: AudioClip | null = null;

    @property({ displayName: '音效音量', range: [0, 1, 0.05], slide: true })
    sfxVolume = 1;

    private _picked = false;

    onLoad(): void {
        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.sensor = true;
            collider.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
        }
    }

    private _onContact(_self: Collider2D, other: Collider2D): void {
        if (this._picked || other.group !== GROUP.PLAYER) return;
        this._picked = true;

        const gs = GameState.i;
        if (this.type === DropType.COIN) {
            gs.addCoins(this.amount);
        } else {
            gs.addKeys(this.amount);
        }

        if (this.pickupSound) {
            const src = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
            src.playOneShot(this.pickupSound, this.sfxVolume);
        }

        // 延迟到下一帧销毁，避免物理回调中直接操作 RigidBody
        this.scheduleOnce(() => this.node.destroy());
    }
}
