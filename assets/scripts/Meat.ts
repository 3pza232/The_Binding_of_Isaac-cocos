import { _decorator, Node } from "cc";
import { ItemBase } from "./ItemBase";
import { GameState } from "./GameState";

const { ccclass } = _decorator;

@ccclass("Meat")
export class Meat extends ItemBase {
    protected onPickup(_player: Node): void {
        const gs = GameState.i;
        gs.setMaxHp(gs.maxHp + 2);
        gs.heal(2);
    }
}
