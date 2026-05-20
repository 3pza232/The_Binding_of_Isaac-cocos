import {
    _decorator,
    Component,
    Node,
    RigidBody2D,
    Animation,
    Sprite,
    SpriteFrame,
    input,
    Input,
    KeyCode,
    EventKeyboard,
    Vec2,
    v2,
} from "cc";

const { ccclass, property } = _decorator;

/** 身体朝向 */
export type Facing = "right" | "left" | "down" | "up";

/**
 * 身体控制组件，挂载于 Isaac 节点。
 * WASD 移动 + RigidBody2D 驱动 + 动画切换。
 */
@ccclass("Body")
export class Body extends Component {
    // ── 属性 ──

    @property({ displayName: "移动速度(px/s)" })
    moveSpeed = 5;

    @property({ type: SpriteFrame, displayName: "水平空闲帧" })
    idleHorizontal: SpriteFrame | null = null;

    @property({ type: SpriteFrame, displayName: "垂直空闲帧" })
    idleVertical: SpriteFrame | null = null;

    // ── 公开状态 ──

    /** 身体当前朝向（供 Head 等外部组件读取） */
    get facing(): Facing {
        return this._facing;
    }

    /** 当前移动速度（Body 自身维护的副本，避免触及 Box2D 只读对象） */
    get velocity(): Vec2 {
        return this._currentVel;
    }

    // ── 内部引用 ──

    private _bodyNode: Node = null!;
    private _rigidBody: RigidBody2D = null!;
    private _animation: Animation = null!;
    private _sprite: Sprite = null!;

    // ── 运行时状态 ──

    private _pressed = new Set<KeyCode>();
    private _currentAnim: "x" | "y" | null = null;
    private _facing: Facing = "down";
    private _currentVel = v2(0, 0); // 对外暴露的速度副本
    private _vel2 = v2(0, 0); // 帧内复用方向/速度向量

    // ── 生命周期 ──

    onLoad(): void {
        this._bodyNode = this.node.getChildByName("Body")!;
        this._rigidBody = this.node.getComponent(RigidBody2D)!;
        this._animation = this._bodyNode.getComponent(Animation)!;
        this._sprite = this._bodyNode.getComponent(Sprite)!;
    }

    start(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    update(_dt: number): void {
        const dx = this._axis("D", "A");
        const dy = this._axis("W", "S");
        const moving = dx !== 0 || dy !== 0;

        if (moving) {
            this._move(dx, dy);
        } else if (this._currentAnim !== null) {
            this._idle();
        }
    }

    // ── 移动 ──

    private _move(dx: number, dy: number): void {
        this._vel2.set(dx, dy).normalize();
        this._currentVel.set(this._vel2.x * this.moveSpeed, this._vel2.y * this.moveSpeed);
        this._rigidBody.linearVelocity = this._currentVel;

        this._facing = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "up" : "down";

        if (dx !== 0) {
            if (this._currentAnim !== "x") {
                this._animation.play("isaac_body_x");
                this._currentAnim = "x";
            }
            this._bodyNode.setScale(this._facing === "right" ? 1 : -1, 1, 1);
        } else {
            if (this._currentAnim !== "y") {
                this._animation.play("isaac_body_y");
                this._currentAnim = "y";
            }
            this._bodyNode.setScale(1, 1, 1);
        }
    }

    // ── 空闲 ──

    private _idle(): void {
        this._currentVel.set(0, 0);
        this._rigidBody.linearVelocity = Vec2.ZERO;
        this._animation.stop();
        this._currentAnim = null;

        const isH = this._facing === "right" || this._facing === "left";
        const sf = isH ? this.idleHorizontal : this.idleVertical;
        if (sf) this._sprite.spriteFrame = sf;
        this._bodyNode.setScale(this._facing === "left" ? -1 : 1, 1, 1);
    }

    // ── 输入 ──

    private _axis(pos: string, neg: string): number {
        let v = 0;
        if (this._pressed.has(KeyCode[`KEY_${pos}`])) v += 1;
        if (this._pressed.has(KeyCode[`KEY_${neg}`])) v -= 1;
        return v;
    }

    private _onKeyDown(e: EventKeyboard): void {
        if (this._isWASD(e.keyCode)) this._pressed.add(e.keyCode);
    }

    private _onKeyUp(e: EventKeyboard): void {
        if (this._isWASD(e.keyCode)) this._pressed.delete(e.keyCode);
    }

    private _isWASD(k: KeyCode): boolean {
        return (
            k === KeyCode.KEY_W || k === KeyCode.KEY_A || k === KeyCode.KEY_S || k === KeyCode.KEY_D
        );
    }
}
