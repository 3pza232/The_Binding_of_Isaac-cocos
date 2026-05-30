import {
    _decorator, Component, Node, Animation,
    Sprite, SpriteFrame, input, Input, KeyCode, EventKeyboard, Vec2, v2, sys,
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
        if (sys.isMobile) return GameState.i.mobileAimDir;
        if (this._pressTimes.size === 0) return null;
        const k = this._latestKey();
        if (k === null) return null;
        const d = KEY_TO_DIR[k];
        if (d === undefined) return null;
        return DIR_VEC[d] ?? null;
    }

    /** 最后松开的射击方向（蓄力激光用），无箭头键按下时有效 */
    fireDir: Vec2 | null = null;

    private _headNode: Node = null!;
    private _animation: Animation = null!;
    private _sprite: Sprite = null!;
    private _body: Body = null!;
    private _pressTimes = new Map<KeyCode, number>();
    private _lastFollowFacing = '';
    private _mobileLastDir: Vec2 | null = null;

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
        // 清理传门期间可能丢失 release 事件的过时按键
        // 因为每帧 update 会刷新时间戳，只有真正松键后不再刷新的才算残留
        const now = Date.now();
        for (const [k, ts] of this._pressTimes) {
            if (now - ts > 500) {
                this._pressTimes.delete(k);
                GameState.i.heldAimKeys.delete(k);
            }
        }
        if (this._pressTimes.size > 0) {
            const k = this._latestKey();
            if (k !== null) this._applyDir(KEY_TO_DIR[k]);
        }
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    update(_dt: number): void {
        if (sys.isMobile) {
            if (GameState.i.mobileAimDir) {
                this.fireDir = null;
                const md = GameState.i.mobileAimDir;
                if (!this._mobileLastDir || md.x !== this._mobileLastDir.x || md.y !== this._mobileLastDir.y) {
                    this._mobileLastDir = md.clone();
                    this._applyMobileAim(md);
                }
            } else {
                this._mobileLastDir = null;
                this.fireDir = GameState.i.mobileFireDir;
                this._followBody();
            }
            return;
        }

        if (this._pressTimes.size === 0) {
            this._followBody();
        } else {
            // 每帧刷新时间戳，防止跨房间恢复时被 500ms 阈值误清理
            const now = Date.now();
            for (const k of this._pressTimes.keys()) {
                GameState.i.heldAimKeys.set(k, now);
            }
        }
    }

    private _onKeyDown(e: EventKeyboard): void {
        const d = KEY_TO_DIR[e.keyCode];
        if (d === undefined) return;
        this.fireDir = null;  // 新键按下 → 取消蓄力方向
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
            this.fireDir = DIR_VEC[d] ?? null;  // 最后松键 → 蓄力方向
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

    private _applyMobileAim(d: Vec2): void {
        if (d.y > 0) this._applyDir(Dir.UP);
        else if (d.y < 0) this._applyDir(Dir.DOWN);
        else if (d.x > 0) this._applyDir(Dir.RIGHT);
        else this._applyDir(Dir.LEFT);
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
