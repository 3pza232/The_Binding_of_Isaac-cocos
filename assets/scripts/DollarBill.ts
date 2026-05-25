import { _decorator, Node, Color } from 'cc';
import { ItemBase } from './ItemBase';
import { GameState } from './GameState';
import { EffectPipeline } from './EffectPipeline';
import { AttackContext } from './AttackContext';

const { ccclass, property } = _decorator;

@ccclass('DollarBill')
export class DollarBill extends ItemBase {

    @property({ displayName: '刷新间隔(秒)', range: [0.1, 3, 0.1], slide: true })
    interval = 0.5;

    static active = false;
    static dmg = 0;
    static color = Color.WHITE.clone();
    private static _interval = 0.5;
    private static _timer = 0;

    /** 效果修饰器 — 注册到管线，每次攻击时自动 apply */
    static readonly modifier = (ctx: AttackContext): void => {
        if (DollarBill.active) {
            ctx.damage += DollarBill.dmg;
            ctx.color = DollarBill.color.clone();
        }
    };

    protected onPickup(_player: Node): void {
        DollarBill._interval = this.interval;
        DollarBill.active = true;
        DollarBill._timer = 0;
        DollarBill.refresh();
        GameState.i.onFrame(dt => DollarBill.tick(dt));
        GameState.i.dollarBill = true;
        EffectPipeline.register(DollarBill.modifier);
    }

    /** 读档恢复 — 重新注册管线效果和帧刷新 */
    static restoreEffect(): void {
        DollarBill.active = true;
        DollarBill._timer = 0;
        DollarBill.refresh();
        GameState.i.onFrame(dt => DollarBill.tick(dt));
        EffectPipeline.register(DollarBill.modifier);
    }

    static tick(dt: number): void {
        DollarBill._timer -= dt;
        if (DollarBill._timer <= 0) {
            DollarBill._timer = DollarBill._interval;
            DollarBill.refresh();
        }
    }

    static refresh(): void {
        DollarBill.dmg = Math.random() < 0.5 ? 1 : -1;
        DollarBill.color = new Color(
            Math.random() * 255,
            Math.random() * 255,
            Math.random() * 255,
            255,
        );
    }
}
