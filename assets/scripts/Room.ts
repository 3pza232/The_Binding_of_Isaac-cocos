import { _decorator, Component, Enum } from 'cc';
import { DoorController } from './DoorController';
import { Monster } from './Monster';
import { BossIntroManager } from './BossIntroManager';

const { ccclass, property } = _decorator;

export enum RoomType {
    START = 0,
    MONSTER = 1,
    TREASURE = 2,
    SHOP = 3,
    BOSS = 4,
}

/** 门默认打开的房间 */
const DOOR_DEFAULT_OPEN = new Set<RoomType>([RoomType.START, RoomType.TREASURE, RoomType.SHOP]);

@ccclass('Room')
export class Room extends Component {

    @property({ type: Enum(RoomType), displayName: '房间类型' })
    roomType: RoomType = RoomType.MONSTER;

    // ── 状态 ──

    private _doors: DoorController[] = [];
    private _isActive = false;
    private _cleared = false;
    private _itemTaken = false;

    get cleared(): boolean { return this._cleared; }
    get isActive(): boolean { return this._isActive; }
    get itemTaken(): boolean { return this._itemTaken; }
    get doors(): DoorController[] { return this._doors; }

    /** 仅设标记，不操作门（供读档用，门由 enter() 统一管理） */
    restoreState(cleared: boolean, itemTaken: boolean): void {
        this._cleared = cleared;
        this._itemTaken = itemTaken;
    }

    markItemTaken(): void { this._itemTaken = true; }

    // ── 生命周期 ──

    start(): void {
        const doorContainer = this.node.getChildByName('Door');
        if (doorContainer) {
            for (const child of doorContainer.children) {
                const dc = child.getComponent(DoorController);
                if (dc) this._doors.push(dc);
            }
        }

        if (this.roomType !== RoomType.START) {
            this.scheduleOnce(() => {
                if (this._isActive) return;
                this.node.active = false;
            }, 0);
        } else {
            this._isActive = true;
            this.scheduleOnce(() => {
                for (const door of this._doors) door.open();
            }, 0);
        }
    }

    update(_dt: number): void {
        if (!this._isActive || this._cleared) return;
        if (this._allMonstersDead()) {
            this._setCleared(true);
        }
    }

    // ── 公开方法 ──

    enter(): void {
        this._isActive = true;
        this.node.active = true;

        if (this.roomType === RoomType.BOSS && !this._cleared) {
            const mgr = this.node.getChildByName('RoomManager');
            if (mgr) {
                for (const child of mgr.children) {
                    if (child.getComponent(Monster)) {
                        const gx = Math.round(this.node.position.x / 900);
                        const gy = Math.round(this.node.position.y / 600);
                        BossIntroManager.show(child, `${gx},${gy}`);
                        break;
                    }
                }
            }
        }

        if (this._cleared || DOOR_DEFAULT_OPEN.has(this.roomType)) {
            for (const door of this._doors) door.open();
        } else {
            for (const door of this._doors) door.close();
        }
    }

    leave(): void {
        this._isActive = false;
        this.node.active = false;
    }

    // ── 内部 ──

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
