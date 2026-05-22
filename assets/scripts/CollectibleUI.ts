import { _decorator, Component, Sprite, SpriteFrame } from 'cc';

const { ccclass } = _decorator;

@ccclass('CollectibleUI')
export class CollectibleUI extends Component {

    static instance: CollectibleUI | null = null;

    private static readonly MAX_SLOTS = 25;

    private _sprites: Sprite[] = [];
    private _queue: SpriteFrame[] = [];

    onLoad(): void {
        CollectibleUI.instance = this;
        this._sprites = [];
        for (let i = 1; i <= CollectibleUI.MAX_SLOTS; i++) {
            const name = i < 10 ? `item_0${i}` : `item_${i}`;
            const child = this.node.getChildByName(name);
            if (child) {
                this._sprites.push(child.getComponent(Sprite)!);
            }
        }
    }

    onDestroy(): void {
        if (CollectibleUI.instance === this) {
            CollectibleUI.instance = null;
        }
    }

    addCollectible(sf: SpriteFrame): void {
        if (this._queue.length >= CollectibleUI.MAX_SLOTS) {
            this._queue.shift();
        }
        this._queue.push(sf);
        this._refreshUI();
    }

    private _refreshUI(): void {
        for (let i = 0; i < this._sprites.length; i++) {
            this._sprites[i].spriteFrame = i < this._queue.length ? this._queue[i] : null;
        }
    }
}
