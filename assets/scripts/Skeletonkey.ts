import { _decorator, Node } from 'cc';
import { ItemBase } from './ItemBase';
import { GameState } from './GameState';

const { ccclass } = _decorator;

@ccclass('Skeletonkey')
export class Skeletonkey extends ItemBase {
    protected onPickup(_player: Node): void {
        GameState.i.addKeys(99);
    }
}
