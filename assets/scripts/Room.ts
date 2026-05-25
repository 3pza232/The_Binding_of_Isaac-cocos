import { _decorator, Component, Enum, Node, UITransform, Sprite, RigidBody2D } from "cc";
import { DoorController } from "./DoorController";
import { Monster } from "./Monster";
import { BossIntroManager } from "./BossIntroManager";
import { SceneDoor } from "./SceneDoor";

const { ccclass, property } = _decorator;

export enum RoomType {
    START = 0,
    MONSTER = 1,
    TREASURE = 2,
    SHOP = 3,
    BOSS = 4,
}

const DOOR_DEFAULT_OPEN = new Set<RoomType>([RoomType.START, RoomType.TREASURE, RoomType.SHOP]);

@ccclass("Room")
export class Room extends Component {
    @property({ type: Enum(RoomType), displayName: "房间类型" })
    roomType: RoomType = RoomType.MONSTER;

    @property({ type: Node, displayName: "Boss血条节点" })
    bossHealthBar: Node | null = null;

    @property({ displayName: "血条平滑时间(秒)", range: [0.05, 1, 0.05], slide: true })
    barSmoothTime = 0.2;

    @property({ type: Node, displayName: "通关门节点" })
    nextDoor: Node | null = null;

    @property({ displayName: "通关门延迟(秒)" })
    nextDoorDelay = 2;

    // ── 状态 ──

    private _doors: DoorController[] = [];
    private _isActive = false;
    private _cleared = false;
    private _itemTaken = false;

    get cleared(): boolean {
        return this._cleared;
    }
    get isActive(): boolean {
        return this._isActive;
    }
    get itemTaken(): boolean {
        return this._itemTaken;
    }
    get doors(): DoorController[] {
        return this._doors;
    }

    restoreState(cleared: boolean, itemTaken: boolean): void {
        this._cleared = cleared;
        this._itemTaken = itemTaken;
    }

    markItemTaken(): void {
        this._itemTaken = true;
    }

    // ── Boss 血条 ──

    private _bar02Ut: UITransform | null = null;
    private _bar02Sprite: Sprite | null = null;
    private _bar02MaxW = 0;
    private _barDisplayW = 0;
    private _boss: Monster | null = null;

    // ── 生命周期 ──

    start(): void {
        const doorContainer = this.node.getChildByName("Door");
        if (doorContainer) {
            for (const child of doorContainer.children) {
                const dc = child.getComponent(DoorController);
                if (dc) this._doors.push(dc);
            }
        }

        // 初始化 Boss 血条
        if (this.bossHealthBar) {
            const bar02 = this.bossHealthBar.getChildByName("Bar_02");
            if (bar02) {
                this._bar02Ut = bar02.getComponent(UITransform);
                this._bar02Sprite = bar02.getComponent(Sprite);
                if (this._bar02Ut) {
                    const oldAx = this._bar02Ut.anchorX;
                    this._bar02Ut.anchorX = 0;
                    const w = this._bar02Ut.width;
                    bar02.setPosition(bar02.position.x + w * (0 - oldAx), bar02.position.y);
                    this._bar02MaxW = w;
                }
                if (this._bar02Sprite) this._bar02Sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            }
            this.bossHealthBar.active = false;
        }

        // 从 MapGenerator 获取下一场景名，传给 SceneDoor
        if (this.nextDoor && this.roomType === RoomType.BOSS) {
            const mg = this.node.parent?.getComponent("MapGenerator") as any;
            if (mg?.nextSceneName) {
                const sd = this.nextDoor.getComponent(SceneDoor);
                if (sd) sd.sceneName = mg.nextSceneName;
            }
        }

        // 已清除的 Boss 房：通关门直接到终态
        if (this._cleared && this.roomType === RoomType.BOSS) {
            this._applyNextDoorFinal();
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

    update(dt: number): void {
        if (!this._isActive || this._cleared) return;

        // Boss 血条平滑更新
        if (this._boss && this._bar02Ut) {
            const targetW = this._boss.alive
                ? this._bar02MaxW * Math.max(0, this._boss.currentHp / this._boss.hpMax)
                : 0;
            const t = Math.min((1 / Math.max(0.01, this.barSmoothTime)) * dt, 1);
            this._barDisplayW += (targetW - this._barDisplayW) * t;
            this._bar02Ut.width = this._barDisplayW;
        }

        if (this._allMonstersDead()) {
            if (!this._boss || this._barDisplayW < 0.5) {
                this._setCleared(true);
            }
        }
    }

    // ── 公开方法 ──

    enter(): void {
        this._isActive = true;
        this.node.active = true;

        if (this.roomType === RoomType.BOSS && !this._cleared) {
            const mgr = this.node.getChildByName("RoomManager");
            if (mgr) {
                for (const child of mgr.children) {
                    const m = child.getComponent(Monster);
                    if (m && m.alive) {
                        const gx = Math.round(this.node.position.x / 900);
                        const gy = Math.round(this.node.position.y / 600);
                        BossIntroManager.show(child, `${gx},${gy}`);

                        this._boss = m;
                        break;
                    }
                }
            }

            if (this.bossHealthBar) {
                this.bossHealthBar.active = true;
                if (this._boss && this._bar02Ut) {
                    const r = Math.max(0, this._boss.currentHp / this._boss.hpMax);
                    this._barDisplayW = this._bar02MaxW * r;
                    this._bar02Ut.width = this._barDisplayW;
                }
            }
        }

        // 已清除的 Boss 房 → 通关门直接终态
        if (this.roomType === RoomType.BOSS && this._cleared && this.nextDoor) {
            this._applyNextDoorFinal();
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
        this._boss = null;
        if (this.bossHealthBar) this.bossHealthBar.active = false;
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
            if (this.bossHealthBar) this.bossHealthBar.active = false;

            // Boss 击败 → 显示通关门，延迟切换到终态
            if (this.roomType === RoomType.BOSS && this.nextDoor) {
                this.nextDoor.active = true;
                this.scheduleOnce(() => this._applyNextDoorFinal(), this.nextDoorDelay);
            }
        }
    }

    /** 通关门终态：激活 / Door_01 隐藏 / Door_02 显示 / 物理启用 */
    private _applyNextDoorFinal(): void {
        if (!this.nextDoor) return;
        this.nextDoor.active = true;
        const d1 = this.nextDoor.getChildByName("Door_01");
        const d2 = this.nextDoor.getChildByName("Door_02");
        if (d1) d1.active = false;
        if (d2) d2.active = true;
        const rb = this.nextDoor.getComponent(RigidBody2D);
        if (rb) rb.enabled = true;
    }
}
