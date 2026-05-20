import { _decorator, Node, SpriteFrame } from "cc";
import { Monster } from "./Monster";

const { ccclass, property } = _decorator;

/**
 * Fatty 小怪脚本，挂载于 Fatty 节点。
 * 所有可调参数 + Body/Head 节点引用均在此处 @property。
 */
@ccclass("Fatty")
export class Fatty extends Monster {
    // ── 节点引用 ──

    @property({ type: Node, displayName: "身体节点" })
    bodyNode: Node = null!;

    @property({ type: Node, displayName: "头部节点" })
    headNode: Node = null!;

    // ── AI 参数 ──

    @property({ displayName: "追踪范围(半径)" })
    trackRange = 150;

    @property({ displayName: "移动速度" })
    moveSpeed = 3;

    @property({ displayName: "闲逛概率", range: [0, 1, 0.05], slide: true })
    wanderRatio = 0.3;

    // ── 战斗参数 ──

    @property({ displayName: "最大血量" })
    maxHp = 6;

    @property({ displayName: "受击闪烁时长(秒)" })
    hitFlashDuration = 0.5;

    @property({ displayName: "死亡淡出时长(秒)" })
    deathFadeDuration = 1.5;

    // ── 空闲帧 ──

    @property({ type: SpriteFrame, displayName: "水平空闲帧" })
    idleHorizontal: SpriteFrame | null = null;

    @property({ type: SpriteFrame, displayName: "垂直空闲帧" })
    idleVertical: SpriteFrame | null = null;

    // ── 基类 getter 实现 ──

    protected get _bodyNode(): Node {
        return this.bodyNode;
    }
    protected get _headNode(): Node {
        return this.headNode;
    }
    protected get _trackRange(): number {
        return this.trackRange;
    }
    protected get _moveSpeed(): number {
        return this.moveSpeed;
    }
    protected get _wanderRatio(): number {
        return this.wanderRatio;
    }
    protected get _maxHp(): number {
        return this.maxHp;
    }
    protected get _hitFlashDuration(): number {
        return this.hitFlashDuration;
    }
    protected get _deathFadeDuration(): number {
        return this.deathFadeDuration;
    }

    // ── 动画 ──

    protected _playAnimX(): string {
        return "fatty_body_x";
    }
    protected _playAnimY(): string {
        return "fatty_body_y";
    }

    protected _setIdleFrame(): void {
        const isH = this._facing === "right" || this._facing === "left";
        const sf = isH ? this.idleHorizontal : this.idleVertical;
        if (sf) this._bodySprite.spriteFrame = sf;
    }
}
