import { _decorator, Component, Enum } from "cc";
import { DoorController } from "./DoorController";
import { Monster } from "./Monster";
import { BossIntroManager } from "./BossIntroManager";

const { ccclass, property } = _decorator;

/** 房间类型（可在编辑器中通过 property 选择） */
export enum RoomType {
    /** 开始房间 — 门默认打开 */
    START = 0,
    /** 怪物房 — 门默认关闭，消灭全部怪物后打开 */
    MONSTER = 1,
    /** 宝箱房 — 门默认打开 */
    TREASURE = 2,
    /** 商店房 — 门默认打开 */
    SHOP = 3,
    /** Boss房 — 门默认关闭，消灭Boss后打开 */
    BOSS = 4,
}

/** 门默认打开的房间类型 */
const DOOR_DEFAULT_OPEN = new Set<RoomType>([RoomType.START, RoomType.TREASURE, RoomType.SHOP]);

/**
 * 房间组件，挂载于 Room_0* 节点。
 * 管理房间激活/失活、门开关、清除条件检测。
 */
@ccclass("Room")
export class Room extends Component {
    @property({ type: Enum(RoomType), displayName: "房间类型" })
    roomType: RoomType = RoomType.MONSTER;

    // ── 内部状态 ──

    private _doors: DoorController[] = [];
    private _isActive = false;
    private _cleared = false;

    get cleared(): boolean {
        return this._cleared;
    }
    get isActive(): boolean {
        return this._isActive;
    }

    // ── 生命周期 ──

    start(): void {
        // 收集本房间所有门的引用
        const doorContainer = this.node.getChildByName("Door");
        if (doorContainer) {
            for (const child of doorContainer.children) {
                const dc = child.getComponent(DoorController);
                if (dc) this._doors.push(dc);
            }
        }

        // 非开始房间默认失活（门状态由 enter() 首次进入时设定）
        if (this.roomType !== RoomType.START) {
            this.scheduleOnce(() => {
                this.node.active = false;
            }, 0);
        } else {
            this._isActive = true;
            // 开始房间门默认打开，延迟到下一帧确保 DoorController.start() 已完成
            this.scheduleOnce(() => {
                for (const door of this._doors) door.open();
            }, 0);
        }
    }

    update(_dt: number): void {
        if (!this._isActive || this._cleared) return;
        if (this._checkCleared()) {
            this._setCleared(true);
        }
    }

    // ── 公开方法 ──

    /** 玩家进入本房间时调用 */
    enter(): void {
        this._isActive = true;
        this.node.active = true;

        // Boss 入场展示（仅在首次进入且 Boss 存活时）
        if (this.roomType === RoomType.BOSS && !this._cleared) {
            const mgr = this.node.getChildByName('RoomManager');
            if (mgr) {
                for (const child of mgr.children) {
                    if (child.getComponent(Monster)) {
                        BossIntroManager.show(child, this.node.uuid);
                        break;
                    }
                }
            }
        }

        // 根据房间类型与清除状态决定门开关
        if (this._cleared) {
            for (const door of this._doors) door.open();
        } else if (DOOR_DEFAULT_OPEN.has(this.roomType)) {
            for (const door of this._doors) door.open();
        } else {
            for (const door of this._doors) door.close();
        }
    }

    /** 玩家离开本房间时调用 */
    leave(): void {
        this._isActive = false;
        this.node.active = false;
    }

    // ── 清除检测 ──

    private _checkCleared(): boolean {
        switch (this.roomType) {
            case RoomType.MONSTER:
            case RoomType.BOSS:
                return this._allMonstersDead();
            default:
                // START / TREASURE / SHOP 无清除条件
                return false;
        }
    }

    private _allMonstersDead(): boolean {
        let alive = false;
        this.node.walk((n) => {
            const m = n.getComponent(Monster);
            if (m && m.alive) alive = true;
        });
        return !alive;
    }

    private _setCleared(value: boolean): void {
        this._cleared = value;
        if (value) {
            for (const door of this._doors) door.open();
        }
    }
}
