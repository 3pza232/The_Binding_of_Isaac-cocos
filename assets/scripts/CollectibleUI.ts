import { _decorator, Component, Sprite, SpriteFrame } from 'cc';

const { ccclass } = _decorator;

@ccclass('CollectibleUI')
export class CollectibleUI extends Component {

    static instance: CollectibleUI | null = null;

    private static readonly MAX_SLOTS = 25;

    private _sprites: Sprite[] = [];
    private _queue: SpriteFrame[] = [];
    private _itemNames: string[] = [];

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

    addCollectible(sf: SpriteFrame, itemName: string): void {
        if (this._queue.length >= CollectibleUI.MAX_SLOTS) {
            this._queue.shift();
            this._itemNames.shift();
        }
        this._queue.push(sf);
        this._itemNames.push(itemName);
        this._refreshUI();
    }

    /** 存档用：获取藏品栏名字队列 */
    getItemNames(): string[] {
        return [...this._itemNames];
    }

    /** 读档用：从名字队列恢复，需传入 name→SpriteFrame 映射 */
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
