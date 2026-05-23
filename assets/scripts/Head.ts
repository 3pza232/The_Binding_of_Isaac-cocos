import {
    _decorator, Component, Node, Animation,
    Sprite, SpriteFrame, input, Input, KeyCode, EventKeyboard, Vec2, v2,
} from 'cc';
import { Body } from './Body';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

const enum Dir { NONE, RIGHT, LEFT, DOWN, UP }

@ccclass('Head')
export class Head extends Component {

    @property({ type: SpriteFrame, displayName: '水平空闲帧' })
    idleHorizontal: SpriteFrame | null = null;

    @property({ type: SpriteFrame, displayName: '向下空闲帧' })
    idleDown: SpriteFrame | null = null;

    @property({ type: SpriteFrame, displayName: '向上空闲帧' })
    idleUp: SpriteFrame | null = null;

    /** 当前瞄准方向（无箭头键时返回 null） */
    get aimDirection(): Vec2 | null {
        if (this._pressTimes.size === 0) return null;
        const k = this._latestKey();
        if (k === null) return null;
        const d = KEY_TO_DIR[k];
        if (d === undefined) return null;
        return DIR_VEC[d] ?? null;
    }

    private _headNode: Node = null!;
    private _animation: Animation = null!;
    private _sprite: Sprite = null!;
    private _body: Body = null!;
    private _pressTimes = new Map<KeyCode, number>();
    private _lastFollowFacing = '';

    onLoad(): void {
        this._headNode = this.node.getChildByName('Head')!;
        this._animation = this._headNode.getComponent(Animation)!;
        this._sprite = this._headNode.getComponent(Sprite)!;
        this._body = this.node.getComponent(Body)!;
    }

    start(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
        this._pressTimes = new Map(GameState.i.heldAimKeys);
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    update(_dt: number): void {
        if (this._pressTimes.size === 0) this._followBody();
    }

    private _onKeyDown(e: EventKeyboard): void {
        const d = KEY_TO_DIR[e.keyCode];
        if (d === undefined) return;
        const ts = Date.now();
        this._pressTimes.set(e.keyCode, ts);
        GameState.i.heldAimKeys.set(e.keyCode, ts);
        this._applyDir(d);
    }

    private _onKeyUp(e: EventKeyboard): void {
        const d = KEY_TO_DIR[e.keyCode];
        if (d === undefined) return;
        this._pressTimes.delete(e.keyCode);
        GameState.i.heldAimKeys.delete(e.keyCode);

        if (this._pressTimes.size === 0) {
            this._lastFollowFacing = '';
            this._followBody();
        } else {
            const k = this._latestKey();
            if (k !== null) this._applyDir(KEY_TO_DIR[k]);
        }
    }

    private _latestKey(): KeyCode | null {
        let best: KeyCode | null = null;
        let bestT = 0;
        for (const [k, t] of this._pressTimes) {
            if (t > bestT) { bestT = t; best = k; }
        }
        return best;
    }

    private _applyDir(d: Dir): void {
        switch (d) {
            case Dir.RIGHT:
                this._headNode.setScale(1, 1, 1);
                this._animation.play('isaac_head_x');
                break;
            case Dir.LEFT:
                this._headNode.setScale(-1, 1, 1);
                this._animation.play('isaac_head_x');
                break;
            case Dir.DOWN:
                this._headNode.setScale(1, 1, 1);
                this._animation.play('isaac_head_down');
                break;
            case Dir.UP:
                this._headNode.setScale(1, 1, 1);
                this._animation.play('isaac_head_up');
                break;
        }
    }

    private _followBody(): void {
        const f = this._body.facing;
        if (f === this._lastFollowFacing) return;
        this._lastFollowFacing = f;
        this._animation.stop();

        let sf: SpriteFrame | null = null;

        switch (f) {
            case 'right':
                this._headNode.setScale(1, 1, 1);
                sf = this.idleHorizontal;
                break;
            case 'left':
                this._headNode.setScale(-1, 1, 1);
                sf = this.idleHorizontal;
                break;
            case 'down':
                this._headNode.setScale(1, 1, 1);
                sf = this.idleDown;
                break;
            case 'up':
                this._headNode.setScale(1, 1, 1);
                sf = this.idleUp;
                break;
        }

        if (sf) this._sprite.spriteFrame = sf;
    }
}

const KEY_TO_DIR: Record<number, Dir> = {
    [KeyCode.ARROW_RIGHT]: Dir.RIGHT,
    [KeyCode.ARROW_LEFT]: Dir.LEFT,
    [KeyCode.ARROW_DOWN]: Dir.DOWN,
    [KeyCode.ARROW_UP]: Dir.UP,
};

const DIR_VEC: Record<number, Vec2> = {
    [Dir.RIGHT]: v2(1, 0),
    [Dir.LEFT]: v2(-1, 0),
    [Dir.DOWN]: v2(0, -1),
    [Dir.UP]: v2(0, 1),
};
