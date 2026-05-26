import { _decorator, Component, Node, Collider2D, Contact2DType, UIOpacity, tween } from 'cc';
import { Monster } from './Monster';
import { Brimstone } from './Brimstone';

const { ccclass } = _decorator;

@ccclass('BrimstoneLaser')
export class BrimstoneLaser extends Component {

    damage = 0;
    playerNode: Node | null = null;
    offsetX = 0;
    offsetY = 0;
    trackingMode = false;   // true 时策略控制 position，这里只做伤害计时
    segIndex = 0;            // 段在链中的索引（追踪用）
    onHitEnemy: ((enemyNode: Node, segIdx: number) => void) | null = null;

    private _contacts = new Set<Collider2D>();
    private _tickTimer = 0;
    private _fadeDone = false;

    onLoad(): void {
        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onBegin, this);
            collider.on(Contact2DType.END_CONTACT, this._onEnd, this);
        }
    }

    startLaser(): void {
        this._tickTimer = 0;
        this.scheduleOnce(() => this._startFade(), Brimstone.laserDuration);
    }

    update(dt: number): void {
        if (this._fadeDone) return;

        if (!this.trackingMode) {
            if (this.playerNode && this.playerNode.isValid) {
                const pw = this.playerNode.worldPosition;
                this.node.setWorldPosition(pw.x + this.offsetX, pw.y + this.offsetY, 0);
            }
        }

        this._tickTimer -= dt;
        if (this._tickTimer <= 0) {
            this._tickTimer = 1 / Brimstone.tickRate;
            for (const c of this._contacts) {
                if (!c.node) continue;
                const m = c.node.getComponent(Monster);
                if (m && m.alive) {
                    m.takeDamage(this.damage);
                    this.onHitEnemy?.(c.node, this.segIndex);
                }
            }
        }
    }

    private _onBegin(_self: Collider2D, other: Collider2D): void {
        this._contacts.add(other);
    }

    private _onEnd(_self: Collider2D, other: Collider2D): void {
        this._contacts.delete(other);
    }

    private _startFade(): void {
        const opacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        opacity.opacity = 255;
        tween(opacity)
            .to(Brimstone.fadeTime, { opacity: 0 })
            .call(() => {
                this._fadeDone = true;
                this.node.destroy();
            })
            .start();
    }

    /** 转为追踪模式：不再跟随玩家，由策略每帧 setWorldPosition */
    enableTracking(idx: number, cb: (enemyNode: Node, segIdx: number) => void): void {
        this.trackingMode = true;
        this.segIndex = idx;
        this.onHitEnemy = cb;
    }

    /** 遍历当前接触的碰撞器，predicate 过滤后回调 */
    walkContacts(predicate: (c: Collider2D) => boolean, fn: (node: Node) => void): void {
        for (const c of this._contacts) {
            if (c.node && c.node.isValid && predicate(c)) fn(c.node);
        }
    }
}
