import { _decorator, Component, Label, Enum } from 'cc';
import { GameStats } from './GameStats';

const { ccclass, property } = _decorator;

enum CurrencyType {
    KEY,
    COIN,
}

@ccclass('CurrencyDisplay')
export class CurrencyDisplay extends Component {

    @property({ type: Enum(CurrencyType), displayName: '类型' })
    type: CurrencyType = CurrencyType.KEY;

    private _label: Label = null!;

    onLoad(): void {
        this._label = this.node.getChildByName('Quantity')!.getComponent(Label)!;
    }

    update(): void {
        const val = this.type === CurrencyType.KEY ? GameStats.keys : GameStats.coins;
        this._label.string = String(val);
    }
}
