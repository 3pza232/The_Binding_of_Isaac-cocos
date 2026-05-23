import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

const HP_PER_HEART = 2;
const MAX_HEARTS = 8;

@ccclass('HeartUI')
export class HeartUI extends Component {

    @property({ type: SpriteFrame, displayName: '满心' })
    heartFull: SpriteFrame | null = null;

    @property({ type: SpriteFrame, displayName: '半心' })
    heartHalf: SpriteFrame | null = null;

    @property({ type: SpriteFrame, displayName: '空心' })
    heartEmpty: SpriteFrame | null = null;

    private _sprites: Sprite[] = [];
    private _lastHp = -1;
    private _lastMaxHp = -1;

    onLoad(): void {
        // 子节点按名称 1~8 排序（由编辑器保证顺序：上排1-4，下排5-8）
        for (let i = 1; i <= MAX_HEARTS; i++) {
            const child = this.node.getChildByName(String(i));
            if (child) {
                const sp = child.getComponent(Sprite);
                if (sp) this._sprites.push(sp);
            }
        }
        this.updateDisplay();
    }

    update(): void {
        const gs = GameState.i;
        const hp = gs.hp;
        const maxHp = gs.maxHp;
        if (hp !== this._lastHp || maxHp !== this._lastMaxHp) {
            this._lastHp = hp;
            this._lastMaxHp = maxHp;
            this.updateDisplay();
        }
    }

    updateDisplay(): void {
        const hp = this._lastHp;
        const maxHp = this._lastMaxHp;
        const heartCount = Math.min(Math.ceil(maxHp / HP_PER_HEART), MAX_HEARTS);

        for (let i = 0; i < this._sprites.length; i++) {
            const sp = this._sprites[i];
            if (i >= heartCount) { sp.node.active = false; continue; }
            sp.node.active = true;

            // i 越大越先扣血（右下优先）
            const remain = hp - i * HP_PER_HEART;
            if (remain >= HP_PER_HEART) sp.spriteFrame = this.heartFull!;
            else if (remain >= 1)       sp.spriteFrame = this.heartHalf!;
            else                        sp.spriteFrame = this.heartEmpty!;
        }
    }
}
