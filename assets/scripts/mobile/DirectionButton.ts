import { _decorator, Component, v2, sys, Node } from "cc";
import { GameState } from "../GameState";

const { ccclass, property } = _decorator;

/**
 * 射击方向按钮 — 挂在 W/A/S/D 节点上。
 * 按住：设置 mobileAimDir，清除 mobileFireDir（Brimstone 新蓄力方向）。
 * 松开：清除 mobileAimDir，设置 mobileFireDir（Brimstone 发射方向）。
 */
@ccclass("DirectionButton")
export class DirectionButton extends Component {
    @property({ displayName: "方向(-1/0/1)" })
    dirX = 0;

    @property({ displayName: "方向(-1/0/1)" })
    dirY = 0;

    private _dir = v2();

    start(): void {
        if (!sys.isMobile) return;
        this._dir.set(this.dirX, this.dirY);

        this.node.on(Node.EventType.TOUCH_START, this._onDown, this);
        this.node.on(Node.EventType.TOUCH_END, this._onUp, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onUp, this);
    }

    onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this._onDown, this);
        this.node.off(Node.EventType.TOUCH_END, this._onUp, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onUp, this);
    }

    private _onDown(): void {
        GameState.i.mobileFireDir = null;
        GameState.i.mobileAimDir = this._dir;
    }

    private _onUp(): void {
        GameState.i.mobileFireDir = this._dir;
        GameState.i.mobileAimDir = null;
    }
}
