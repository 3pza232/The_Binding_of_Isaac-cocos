import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

@ccclass('ShopItem')
export class ShopItem extends Component {

    @property({ displayName: '价格' })
    price = 15;

    @property({ type: [SpriteFrame], displayName: '数字贴图0-9' })
    digitFrames: SpriteFrame[] = [];

    private _active = false;

    /** 激活商店模式：显示十位个位数字 */
    initShop(): void {
        this._active = true;
        const p = this.price;

        const tenNode = this.node.getChildByName('Ten');
        const oneNode = this.node.getChildByName('Single');
        const tenSp = tenNode?.getComponent(Sprite);
        const oneSp = oneNode?.getComponent(Sprite);

        const tens = Math.floor(p / 10) % 10;
        const ones = p % 10;
        if (tenSp && this.digitFrames[tens]) tenSp.spriteFrame = this.digitFrames[tens];
        if (oneSp && this.digitFrames[ones]) oneSp.spriteFrame = this.digitFrames[ones];
    }

    /** ItemBase 拾取前调用；非商店模式直接放行，商店模式验币扣款 */
    tryBuy(): boolean {
        if (!this._active) return true;
        const gs = GameState.i;
        if (gs.coins < this.price) return false;
        gs.spendCoin(this.price);
        return true;
    }
}
