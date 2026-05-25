import { _decorator, Node } from "cc";
import { ItemBase } from "./ItemBase";
import { GameState } from "./GameState";

const { ccclass, property } = _decorator;

@ccclass("SacredHeart")
export class SacredHeart extends ItemBase {
    @property({ displayName: "伤害修正" })
    damageBonus = 2.3;

    @property({ displayName: "射程增加(px)" })
    rangeInc = 200;

    @property({ displayName: "弹速降低" })
    speedDec = 1;

    protected onPickup(_player: Node): void {
        const gs = GameState.i;
        const newMax = Math.min(gs.maxHp + 2, 16);
        gs.setMaxHp(newMax);
        gs.heal(newMax);

        gs.tearDamage += 1;
        gs.damageMul *= 1 + this.damageBonus;
        gs.range += this.rangeInc;
        gs.tearSpeed = Math.max(1, gs.tearSpeed - this.speedDec);
        gs.homing = true;
    }
}
