import { _decorator, Node } from "cc";
import { ItemBase } from "./ItemBase";
import { PlayerHealth } from "./PlayerHealth";
import { Shoot } from "./Shoot";

const { ccclass, property } = _decorator;

@ccclass("SacredHeart")
export class SacredHeart extends ItemBase {
    @property({ displayName: "伤害修正(+230%=2.3)" })
    damageBonus = 2.3;

    @property({ displayName: "射程增加(px)" })
    rangeInc = 200;

    @property({ displayName: "弹速降低" })
    speedDec = 1;

    protected onPickup(player: Node): void {
        // 1. +1 心之容器 → 回满血
        const newMax = Math.min(PlayerHealth.maxHp + 2, 16);
        PlayerHealth.setMaxHp(newMax);
        const health = player.getComponent("PlayerHealth") as any;
        if (health) health.heal(newMax);

        // 2. 伤害 +1，倍率 *(1+bonus)
        const shoot = player.getComponent(Shoot);
        if (shoot) {
            shoot.tearDamage += 1;
            shoot.damageMultiplier *= 1 + this.damageBonus;
            shoot.range += this.rangeInc;
            shoot.tearSpeed = Math.max(1, shoot.tearSpeed - this.speedDec);
        }

        // 3. 追尾弹
        Shoot.homingEnabled = true;
    }
}
