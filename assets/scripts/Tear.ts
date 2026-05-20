import {
    _decorator,
    Component,
    RigidBody2D,
    Animation,
    Collider2D,
    Contact2DType,
    AudioClip,
    AudioSource,
    v2,
    Vec3,
    Vec2,
} from "cc";

const { ccclass } = _decorator;

/** 泪弹飞行状态 */
type TearState = "fly" | "descend" | "break";

/** 泪弹会因碰撞而破裂的物理分组 */
const BREAK_GROUPS: Record<number, true> = {
    8: true, // ENEMY
    16: true, // ENVIRONMENT（墙）
};

/**
 * 泪弹行为组件，挂载于 Tear 预制体。
 * 所有可调参数由 Shoot 组件通过 init() 传入，本身不暴露 @property。
 */
@ccclass("Tear")
export class Tear extends Component {
    // ── 外部注入参数 ──

    private _speed = 0;
    private _range = 0;
    private _fallSpeed = 0;
    private _fallStartDist = 0;
    private _piercing = false;
    private _isHorizontal = false;
    private _damage = 1;
    private _breakSnd: AudioClip | null = null;
    private _breakVol = 1;

    // ── 内部状态 ──

    private _rigidBody: RigidBody2D = null!;
    private _animation: Animation = null!;
    private _audioSrc: AudioSource = null!;
    private _state: TearState = "fly";
    private _startPos = new Vec3();
    private _breakTimer = 0;
    private _vel2 = v2(0, 0); // 帧复用

    // ── 生命周期 ──

    onLoad(): void {
        this._rigidBody = this.node.getComponent(RigidBody2D)!;
        const bodyNode = this.node.getChildByName("Body")!;
        this._animation = bodyNode.getComponent(Animation)!;

        const collider = this.node.getComponent(Collider2D)!;
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }

        this._audioSrc = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
    }

    // ── 公开方法 ──

    /** 由 Shoot 调用，注入全部运行参数 */
    init(
        dir: Vec2,
        speed: number,
        range: number,
        fallSpeed: number,
        fallStartRatio: number,
        piercing: boolean,
        momentumX: number,
        momentumY: number,
        damage: number,
        breakSnd: AudioClip | null,
        breakVol: number
    ): void {
        this._speed = speed;
        this._range = range;
        this._fallSpeed = fallSpeed;
        this._fallStartDist = range * fallStartRatio;
        this._piercing = piercing;
        this._damage = damage;
        this._breakSnd = breakSnd;
        this._breakVol = breakVol;
        this._isHorizontal = Math.abs(dir.x) > 0.5;
        this._vel2.set(dir.x * speed + momentumX, dir.y * speed + momentumY);
        this._rigidBody.linearVelocity = this._vel2;

        const collider = this.node.getComponent(Collider2D);
        if (collider) collider.sensor = piercing;

        this._state = "fly";
        this.node.getWorldPosition(this._startPos);
    }

    /** 泪弹伤害值（供 Monster 读取） */
    get damage(): number {
        return this._damage;
    }

    // ── 每帧逻辑 ──

    update(dt: number): void {
        if (this._state === "break") {
            this._breakTimer -= dt;
            if (this._breakTimer <= 0) this.node.destroy();
            return;
        }

        // 基于实际世界坐标计算已飞行距离（与怪物追踪半径等统一坐标系）
        const p = this.node.worldPosition;
        const dx = p.x - this._startPos.x;
        const dy = p.y - this._startPos.y;
        const traveled = Math.sqrt(dx * dx + dy * dy);

        // 水平泪弹：进入下降阶段
        if (this._state === "fly" && this._isHorizontal && traveled >= this._fallStartDist) {
            this._state = "descend";
            const dirX = this._rigidBody.linearVelocity.x > 0 ? 1 : -1;
            this._vel2.set(dirX * this._speed, -this._fallSpeed);
            this._rigidBody.linearVelocity = this._vel2;
            this._rigidBody.gravityScale = 1;
        }

        if (traveled >= this._range) {
            this._startBreak();
        }
    }

    // ── 破裂 ──

    private _startBreak(): void {
        if (this._state === "break") return;
        this._state = "break";
        this._breakTimer = 0.6;
        this._vel2.set(0, 0);
        this._rigidBody.linearVelocity = this._vel2;
        this._rigidBody.gravityScale = 0;
        this._animation.play("normal_tear_break");

        if (this._breakSnd) {
            this._audioSrc.playOneShot(this._breakSnd, this._breakVol);
        }
    }

    // ── 碰撞（可扩展：新增破裂分组只需在 BREAK_GROUPS 加一行） ──

    private _onBeginContact(_self: Collider2D, other: Collider2D): void {
        if (this._piercing || this._state === "break") return;
        if (BREAK_GROUPS[other.group]) {
            // TODO: 后续在此触发伤害/效果回调
            this._startBreak();
        }
    }
}
