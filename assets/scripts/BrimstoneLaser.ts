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

    /** 由 Brimstone.fire 调用，注入参数后启动生命周期 */
    startLaser(): void {
        this._tickTimer = 0;
        this.scheduleOnce(() => this._startFade(), Brimstone.laserDuration);
    }

    update(dt: number): void {
        if (this._fadeDone) return;

        // 跟随玩家
        if (this.playerNode && this.playerNode.isValid) {
            const pw = this.playerNode.worldPosition;
            this.node.setWorldPosition(pw.x + this.offsetX, pw.y + this.offsetY, 0);
        }

        this._tickTimer -= dt;
        if (this._tickTimer <= 0) {
            this._tickTimer = 1 / Brimstone.tickRate;
            for (const c of this._contacts) {
                if (!c.node) continue;
                const m = c.node.getComponent(Monster);
                if (m && m.alive) m.takeDamage(this.damage);
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
}
