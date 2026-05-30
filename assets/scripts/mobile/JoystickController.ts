import { _decorator, Component, Node, Vec2, input, Input, EventTouch, v3, sys } from "cc";
import { GameState } from "../GameState";

const { ccclass, property } = _decorator;

/**
 * 虚拟摇杆 — 挂在 Joy 节点上。
 * 全局捕获左半屏触控，驱动 GameState.i.mobileMoveDir。
 */
@ccclass("JoystickController")
export class JoystickController extends Component {
    @property({ type: Node, displayName: "底座节点" })
    joyBase: Node = null!;

    @property({ displayName: "拖拽半径" })
    maxRadius = 80;

    @property({ displayName: "死区半径" })
    deadZone = 10;

    private _center = v3();
    private _touchId: number | null = null;

    start(): void {
        if (!sys.isMobile) return;

        this._center.set(this.joyBase.position);
        this.node.setPosition(this._center);

        input.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    /** 是否被某个触控激活 */
    get active(): boolean {
        return this._touchId !== null;
    }

    // ── 触控 ──

    private _onTouchStart(e: EventTouch): void {
        if (this._touchId !== null) return;

        const touchPos = e.getUILocation();
        const wpos = this.joyBase.worldPosition;
        const d = Math.sqrt((touchPos.x - wpos.x) ** 2 + (touchPos.y - wpos.y) ** 2);
        if (d > this.maxRadius * 2.5) return; // 不在摇杆区域附近

        this._touchId = e.touch!.getID();
        this._applyTouch(touchPos);
    }

    private _onTouchMove(e: EventTouch): void {
        if (e.touch!.getID() !== this._touchId) return;
        this._applyTouch(e.getUILocation());
    }

    private _onTouchEnd(e: EventTouch): void {
        if (e.touch!.getID() !== this._touchId) return;
        this._touchId = null;
        this.node.setPosition(this._center);
        GameState.i.mobileMoveDir.set(0, 0);
    }

    // ── 位置计算 ──

    private _applyTouch(touchUI: Vec2): void {
        const wpos = this.joyBase.worldPosition;
        const dx = touchUI.x - wpos.x;
        const dy = touchUI.y - wpos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.deadZone) {
            this.node.setPosition(this._center);
            GameState.i.mobileMoveDir.set(0, 0);
            return;
        }

        const clamped = Math.min(dist, this.maxRadius);
        const nx = (dx / dist) * clamped;
        const ny = (dy / dist) * clamped;

        this.node.setPosition(this._center.x + nx, this._center.y + ny, 0);
        GameState.i.mobileMoveDir.set(nx / this.maxRadius, ny / this.maxRadius);
    }
}
