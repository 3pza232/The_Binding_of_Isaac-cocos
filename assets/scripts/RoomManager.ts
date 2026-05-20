import { _decorator, Component } from 'cc';
import { DoorController } from './DoorController';

const { ccclass } = _decorator;

/** 房间状态 */
export enum RoomState {
    /** 未探索：玩家从未进入过 */
    UNEXPLORED = 0,
    /** 活跃中：玩家已进入，存在威胁/机关 */
    ACTIVE = 1,
    /** 已清除：所有条件满足，门打开 */
    CLEARED = 2,
}

/**
 * 房间管理基类，挂载于 RoomManager 节点。
 * 持有本房间所有门的引用，根据房间状态主动控制门开关。
 * 子类覆写 checkCleared() 定义清除条件。
 */
@ccclass('RoomManager')
export abstract class RoomManager extends Component {

    private _doors: DoorController[] = [];
    private _roomState: RoomState = RoomState.UNEXPLORED;

    /** 当前房间状态 */
    get roomState(): RoomState { return this._roomState; }

    // ── 生命周期 ──

    start(): void {
        // 收集本节点兄弟节点下的 Door 子节点中的 DoorController
        const parent = this.node.parent!;
        const doorContainer = parent.getChildByName('Door');
        if (doorContainer) {
            for (const child of doorContainer.children) {
                const dc = child.getComponent(DoorController);
                if (dc) this._doors.push(dc);
            }
        }

        this.onRoomInit();
    }

    update(_dt: number): void {
        if (this._roomState === RoomState.ACTIVE && this.checkCleared()) {
            this._setState(RoomState.CLEARED);
        }
    }

    // ── 房间状态 ──

    /** 玩家进入房间时调用 */
    enter(): void {
        if (this._roomState === RoomState.UNEXPLORED) {
            this._setState(RoomState.ACTIVE);
            this.onFirstEnter();
        }
    }

    /** 玩家离开房间时调用 */
    leave(): void { }

    // ── 子类覆写 ──

    /** 初始化回调 */
    protected onRoomInit(): void { }

    /** 首次进入房间回调（在此生成怪物等） */
    protected onFirstEnter(): void { }

    /** 是否满足清除条件（子类覆写） */
    protected abstract checkCleared(): boolean;

    // ── 门控制 ──

    protected _setState(state: RoomState): void {
        if (this._roomState === state) return;
        this._roomState = state;

        switch (state) {
            case RoomState.CLEARED:
                for (const d of this._doors) d.open();
                break;
            default:
                for (const d of this._doors) d.close();
                break;
        }
    }
}
