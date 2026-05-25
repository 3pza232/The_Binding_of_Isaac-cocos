import { _decorator, Node, SpriteFrame } from 'cc';
import { ItemBase } from './ItemBase';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

@ccclass('CupidsArrow')
export class CupidsArrow extends ItemBase {

    @property({ type: SpriteFrame, displayName: '泪弹替换帧' })
    tearSpriteFrame: SpriteFrame | null = null;

    protected onPickup(_player: Node): void {
        const gs = GameState.i;
        gs.tearDamage += 1;
        gs.enemyPiercing = true;
        if (this.tearSpriteFrame) gs.tearSf = this.tearSpriteFrame;
    }
}
