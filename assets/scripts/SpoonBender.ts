import { _decorator, Node, Color } from 'cc';
import { ItemBase } from './ItemBase';
import { GameState } from './GameState';
import { EffectPipeline } from './EffectPipeline';
import { AttackContext } from './AttackContext';

const { ccclass, property } = _decorator;

@ccclass('SpoonBender')
export class SpoonBender extends ItemBase {

    @property({ displayName: '泪弹追踪强度', range: [1, 20, 0.5], slide: true })
    tearHomingStr = 7;

    @property({ displayName: '激光追踪强度倍率', range: [0.5, 3, 0.1], slide: true })
    laserTrackingStr = 1.4;

    private static readonly PURPLE = new Color(180, 80, 255, 255);

    static readonly modifier = (ctx: AttackContext): void => {
        ctx.color = SpoonBender.PURPLE.clone();
    };

    protected onPickup(_player: Node): void {
        const gs = GameState.i;
        gs.homing = true;
        gs.tearHomingStrength = this.tearHomingStr;
        gs.laserHoming = true;
        gs.laserTrackingStrength = this.laserTrackingStr;
        EffectPipeline.register(SpoonBender.modifier);
    }
}
