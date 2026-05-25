import { _decorator, Node } from 'cc';
import { ItemBase } from './ItemBase';
import { GameState } from './GameState';

const { ccclass } = _decorator;

@ccclass('ADollar')
export class ADollar extends ItemBase {
    protected onPickup(_player: Node): void {
        GameState.i.addCoins(99);
    }
}
