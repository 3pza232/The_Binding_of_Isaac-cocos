import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
import { MAX_COLLECTIBLE_SLOTS } from './Constants';

const { ccclass } = _decorator;

@ccclass('CollectibleUI')
export class CollectibleUI extends Component {

    private _sprites: Sprite[] = [];
    private _queue: SpriteFrame[] = [];
    private _itemNames: string[] = [];

    onLoad(): void {
        this._sprites = [];
        for (let i = 1; i <= MAX_COLLECTIBLE_SLOTS; i++) {
            const name = i < 10 ? `item_0${i}` : `item_${i}`;
            const child = this.node.getChildByName(name);
            if (child) {
                this._sprites.push(child.getComponent(Sprite)!);
            }
        }
    }

    addCollectible(sf: SpriteFrame, itemName: string): void {
        if (this._queue.length >= MAX_COLLECTIBLE_SLOTS) {
            this._queue.shift();
            this._itemNames.shift();
        }
        this._queue.push(sf);
        this._itemNames.push(itemName);
        this._refreshUI();
    }

    getItemNames(): string[] {
        return [...this._itemNames];
    }

    restoreFromNames(names: string[], sfMap: Map<string, SpriteFrame>): void {
        this._queue = [];
        this._itemNames = [];
        for (const name of names) {
            const sf = sfMap.get(name);
            if (sf) {
                this._queue.push(sf);
                this._itemNames.push(name);
            }
        }
        this._refreshUI();
    }

    private _refreshUI(): void {
        for (let i = 0; i < this._sprites.length; i++) {
            this._sprites[i].spriteFrame = i < this._queue.length ? this._queue[i] : null;
        }
    }
}
