import {
    _decorator, Component, Node, RigidBody2D, Animation, Sprite,
    Collider2D, Contact2DType, AudioClip, AudioSource, v2, Vec3, Vec2,
} from 'cc';
import { GROUP } from './Constants';
import { DollarBill } from './DollarBill';
import { GameState } from './GameState';

const { ccclass } = _decorator;

type TearState = 'fly' | 'descend' | 'break';

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
    private _enemyPiercing = false;
    private _wallPiercing = false;
    private _isHorizontal = false;
    private _damage = 1;
    private _homing = false;
    private _breakSnd: AudioClip | null = null;
    private _breakVol = 1;

    // ── 内部状态 ──

    private _rigidBody: RigidBody2D = null!;
    private _animation: Animation = null!;
    private _audioSrc: AudioSource = null!;
    private _bodySprite: Sprite | null = null;
    private _bodyNode: Node | null = null;
    private _state: TearState = "fly";
    private _startPos = new Vec3();
    private _breakTimer = 0;
    private _vel2 = v2(0, 0);
    private _hitEnemies = new Set<Node>();
    private _pathDist = 0;
    private _scanTimer = 0;
    private _steerTarget: Node | null = null;
    private _maxLifetime = 0;
    private _lifeTimer = 0;

    // ── 生命周期 ──

    onLoad(): void {
        this._rigidBody = this.node.getComponent(RigidBody2D)!;
        this._bodyNode = this.node.getChildByName("Body")!;
        this._animation = this._bodyNode.getComponent(Animation)!;
        this._bodySprite = this._bodyNode.getComponent(Sprite);

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
        enemyPiercing: boolean,
        wallPiercing: boolean,
        momentumX: number,
        momentumY: number,
        damage: number,
        breakSnd: AudioClip | null,
        breakVol: number,
        homing = false,
    ): void {
        this._speed = speed;
        this._range = range;
        this._fallSpeed = fallSpeed;
        this._fallStartDist = range * fallStartRatio;
        this._enemyPiercing = enemyPiercing;
        this._wallPiercing = wallPiercing;
        this._damage = damage;
        this._homing = homing;
        this._breakSnd = breakSnd;
        this._breakVol = breakVol;
        this._isHorizontal = Math.abs(dir.x) > 0.5;
        this._vel2.set(dir.x * speed + momentumX, dir.y * speed + momentumY);
        this._rigidBody.linearVelocity = this._vel2;
        this._hitEnemies.clear();

        if (this._bodyNode) {
            this._bodyNode.angle = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
        }

        const collider = this.node.getComponent(Collider2D);
        if (collider) collider.sensor = enemyPiercing || wallPiercing;

        this._state = "fly";
        this._pathDist = 0;
        this._lifeTimer = 0;
        this._maxLifetime = (range / speed) * (homing ? 2.5 : 1.1);
        this._scanTimer = 0;
        this._steerTarget = null;
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

        if (DollarBill.active && this._bodySprite) {
            this._bodySprite.color = DollarBill.color;
        }

        this._lifeTimer += dt;

        const v = this._rigidBody.linearVelocity;
        const speed = Math.sqrt(v.x * v.x + v.y * v.y);
        this._pathDist += speed * dt;

        const p = this.node.worldPosition;
        const dx = p.x - this._startPos.x;
        const dy = p.y - this._startPos.y;
        const straightDist = Math.sqrt(dx * dx + dy * dy);

        // 追尾：仅在射程前 80% 生效，避免终段绕圈
        const homingWindow = this._range * 0.8;
        if (this._homing && this._state === "fly" && straightDist < homingWindow) {
            this._scanTimer -= dt;
            if (this._scanTimer <= 0) {
                this._scanTimer = 0.17;  // ~10 帧
                this._steerTarget = this._findNearestEnemy();
            }
            if (this._steerTarget) {
                this._steerTowardTarget(dt, this._steerTarget);
                if (this._bodyNode) {
                    this._bodyNode.angle = Math.atan2(v.y, v.x) * (180 / Math.PI);
                }
            }
        }

        // 水平泪弹：进入下降阶段
        if (this._state === "fly" && this._isHorizontal && this._pathDist >= this._fallStartDist) {
            this._state = "descend";
            const dirX = v.x > 0 ? 1 : -1;
            this._vel2.set(dirX * this._speed, -this._fallSpeed);
            this._rigidBody.linearVelocity = this._vel2;
            this._rigidBody.gravityScale = 1;
        }

        // 三重终止：直线超射程 / 路径里程超限 / 飞行超时（防绕圈无限）
        if (straightDist >= this._range || this._pathDist >= this._range * 1.5 || this._lifeTimer >= this._maxLifetime) {
            this._startBreak();
        }
    }

    /** 搜索最近未击中怪物（昂贵操作，每 10 帧调用一次） */
    private _findNearestEnemy(): Node | null {
        let room = this.node.parent;
        while (room && !room.getComponent('Room')) room = room.parent;
        if (!room) return null;

        let nearest: Node | null = null;
        let nearestD2 = Infinity;
        room.walk((n) => {
            if (this._hitEnemies.has(n)) return;
            const m = n.getComponent('Monster') as any;
            if (m && m.alive && m.isTargetable) {
                const dx = n.worldPosition.x - this.node.worldPosition.x;
                const dy = n.worldPosition.y - this.node.worldPosition.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < nearestD2) { nearestD2 = d2; nearest = n; }
            }
        });
        return nearest;
    }

    /** 朝向目标 steering 微调速度（每帧调用） */
    private _steerTowardTarget(dt: number, target: Node): void {
        const tx = target.worldPosition.x - this.node.worldPosition.x;
        const ty = target.worldPosition.y - this.node.worldPosition.y;
        const mag = Math.sqrt(tx * tx + ty * ty);
        if (mag <= 0) return;

        const desiredX = (tx / mag) * this._speed;
        const desiredY = (ty / mag) * this._speed;
        const v = this._rigidBody.linearVelocity;
        const t = Math.min(GameState.i.tearHomingStrength * dt, 1);
        const newX = v.x + (desiredX - v.x) * t;
        const newY = v.y + (desiredY - v.y) * t;
        const newMag = Math.sqrt(newX * newX + newY * newY);
        if (newMag > 0) {
            this._rigidBody.linearVelocity = v2(
                (newX / newMag) * this._speed,
                (newY / newMag) * this._speed,
            );
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

    // ── 碰撞 ──

    private _onBeginContact(_self: Collider2D, other: Collider2D): void {
        if (this._state === 'break') return;

        if (other.group === GROUP.MONSTER) {
            this._hitEnemies.add(other.node);
            if (!this._enemyPiercing) this._startBreak();
        } else if (other.group === GROUP.WALL) {
            if (!this._wallPiercing) this._startBreak();
        }
    }
}
