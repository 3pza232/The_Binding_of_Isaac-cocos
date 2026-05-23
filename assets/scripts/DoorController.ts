import {
    _decorator, Component, Node, UITransform, Sprite, Collider2D,
    Contact2DType, Prefab, instantiate, find, tween, v3, Vec3, Tween,
} from "cc";
import { RoomType } from "./Room";
import { GameStats } from "./GameStats";

const { ccclass, property } = _decorator;

type DoorStyle = 'normal' | 'treasure' | 'shop' | 'boss';

/** Door 节点上所有可能的子节点名（用于初始化时统一隐藏） */
const ALL_VARIANTS = [
    'Black', 'LeftPanel', 'RightPanel', 'Frame',
    'LeftPanel_Boss', 'RightPanel_Boss', 'Frame_Boss', 'Frame_Boss_Eyes', 'Frame_Boss_Light',
    'RightPanel_Key', 'Frame_Treasure', 'Frame_Shop',
];

@ccclass("DoorController")
export class DoorController extends Component {

    @property({ displayName: "动画时长(秒)" })
    animationDuration = 0.5;

    @property({ type: Node, displayName: "目标房间" })
    targetRoom: Node | null = null;

    @property({ type: Prefab, displayName: "玩家" })
    isaacPrefab: Prefab | null = null;

    @property({ displayName: "门边生成距离(px)" })
    spawnDistance = 50;

    @property({ displayName: '需要钥匙' })
    requiresKey = false;

    get unlocked(): boolean { return this._unlocked; }
    set unlocked(v: boolean) { this._unlocked = v; }

    // ── 内部状态 ──

    private _doorStyle: DoorStyle = 'normal';
    private _unlocked = false;
    private _isOpen = false;
    private _isAnimating = false;
    private _canTeleport = false;
    private _pendingIsaac: Node | null = null;

    private _leftPanel: Node | null = null;
    private _rightPanel: Node | null = null;
    private _leftOrigW = 0;
    private _rightOrigW = 0;
    private _anchorsApplied = false;

    private _eyesNode: Node | null = null;
    private _lightNode: Node | null = null;

    // ── 生命周期 ──

    start(): void {
        this._determineStyle();
        this._initVisuals();

        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
        }
    }

    update(_dt: number): void {
        if (this._pendingIsaac && this._canTeleport) {
            this._doTeleport(this._pendingIsaac);
            this._pendingIsaac = null;
        }
        this._syncBossVisuals();
    }

    // ── Public API ──

    open(): void {
        if (this.requiresKey && !this._unlocked) return;
        this._animate(true);
    }

    close(): void {
        if (this.requiresKey && this._unlocked) return; // 已解锁钥匙门永不关闭
        this._animate(false);
    }

    // ── 门类型判断：自身房间或目标房间中任一是特殊类型即采用对应样式 ──

    private _determineStyle(): void {
        const ownType = this._getOwnRoomType();
        const targetType = this._getRoomType(this.targetRoom);

        if (targetType === RoomType.BOSS || ownType === RoomType.BOSS) {
            this._doorStyle = 'boss';
        } else if (targetType === RoomType.TREASURE || ownType === RoomType.TREASURE) {
            this._doorStyle = 'treasure';
        } else if (targetType === RoomType.SHOP || ownType === RoomType.SHOP) {
            this._doorStyle = 'shop';
        }
    }

    private _getRoomType(node: Node | null): number | null {
        if (!node) return null;
        const room = node.getComponent('Room') as any;
        return room?.roomType ?? null;
    }

    private _getOwnRoomType(): number | null {
        let node = this.node.parent;
        while (node) {
            const room = node.getComponent('Room') as any;
            if (room) return room.roomType;
            node = node.parent;
        }
        return null;
    }

    /** 当前所在房间是否安全（无战斗） */
    private _isRoomSafe(): boolean {
        let node = this.node.parent;
        while (node) {
            const room = node.getComponent('Room') as any;
            if (!room) { node = node.parent; continue; }
            const rt = room.roomType;
            if (rt !== RoomType.MONSTER && rt !== RoomType.BOSS) return true;
            return room.cleared;
        }
        return true;
    }

    // ── 初始化视觉：隐藏全部变体 → 按风格激活对应子节点 ──

    private _initVisuals(): void {
        for (const name of ALL_VARIANTS) {
            const node = this.node.getChildByName(name);
            if (node) node.active = false;
        }

        switch (this._doorStyle) {
            case 'boss':
                this._leftPanel = this.node.getChildByName('LeftPanel_Boss');
                this._rightPanel = this.node.getChildByName('RightPanel_Boss');
                this._eyesNode = this.node.getChildByName('Frame_Boss_Eyes');
                this._lightNode = this.node.getChildByName('Frame_Boss_Light');
                this._show('Black', 'Frame_Boss', 'Frame_Boss_Eyes');
                break;
            case 'treasure':
                this._leftPanel = this.node.getChildByName('LeftPanel');
                this._rightPanel = this.node.getChildByName('RightPanel_Key');
                this._show('Black', 'LeftPanel', 'Frame_Treasure');
                break;
            case 'shop':
                this._leftPanel = this.node.getChildByName('LeftPanel');
                this._rightPanel = this.node.getChildByName('RightPanel_Key');
                this._show('Black', 'LeftPanel', 'Frame_Shop');
                break;
            default:
                this._leftPanel = this.node.getChildByName('LeftPanel');
                this._rightPanel = this.node.getChildByName('RightPanel');
                this._show('Black', 'Frame');
                break;
        }

        if (this._leftPanel) {
            this._leftPanel.active = true;
            this._leftOrigW = this._leftPanel.getComponent(UITransform)!.width;
        }
        if (this._rightPanel) {
            this._rightPanel.active = true;
            this._rightOrigW = this._rightPanel.getComponent(UITransform)!.width;
        }
    }

    private _show(...names: string[]): void {
        for (const name of names) {
            const node = this.node.getChildByName(name);
            if (node) node.active = true;
        }
    }

    // ── 动画：门板向门轴方向压缩/展开 ──

    private _animate(open: boolean): void {
        if (!this._leftPanel || !this._rightPanel) return;
        if (this._isOpen === open && !this._isAnimating) return;

        this._isOpen = open;
        this._isAnimating = true;
        this._canTeleport = false;

        Tween.stopAllByTarget(this._leftPanel);
        Tween.stopAllByTarget(this._rightPanel);

        const dur = this.animationDuration;
        const easing = "sineInOut";

        if (open) {
            if (!this._anchorsApplied) {
                this._setHingeAnchor(this._leftPanel, 0, this._leftOrigW);
                this._setHingeAnchor(this._rightPanel, 1, this._rightOrigW);
                this._anchorsApplied = true;
            }

            this._leftPanel.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;
            this._rightPanel.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;

            let done = 0;
            const onDone = () => {
                done++;
                if (done >= 2) {
                    this._isAnimating = false;
                    this._canTeleport = true;
                }
            };

            tween(this._leftPanel.getComponent(UITransform)!)
                .to(dur, { width: 0 }, { easing })
                .call(onDone)
                .start();
            tween(this._rightPanel.getComponent(UITransform)!)
                .to(dur, { width: 0 }, { easing })
                .call(onDone)
                .start();
        } else {
            let done = 0;
            const onDone = () => {
                done++;
                if (done >= 2) {
                    this._isAnimating = false;
                }
            };

            tween(this._leftPanel.getComponent(UITransform)!)
                .to(dur, { width: this._leftOrigW }, { easing })
                .call(onDone)
                .start();
            tween(this._rightPanel.getComponent(UITransform)!)
                .to(dur, { width: this._rightOrigW }, { easing })
                .call(onDone)
                .start();
        }
    }

    private _setHingeAnchor(panel: Node, hingeAnchorX: number, originalWidth: number): void {
        const uit = panel.getComponent(UITransform)!;
        const oldAx = uit.anchorX;
        uit.anchorX = hingeAnchorX;
        panel.setPosition(
            panel.position.x + originalWidth * (hingeAnchorX - oldAx),
            panel.position.y
        );
    }

    // ── Boss 视觉：Eyes 随存活/死亡切换，Light 随开门切换 ──

    private _findBossRoom(): any {
        if (this.targetRoom) {
            const r = this.targetRoom.getComponent("Room") as any;
            if (r && r.roomType === RoomType.BOSS) return r;
        }
        let node = this.node.parent;
        while (node) {
            const r = node.getComponent("Room") as any;
            if (r && r.roomType === RoomType.BOSS) return r;
            node = node.parent;
        }
        return null;
    }

    private _syncBossVisuals(): void {
        if (this._doorStyle !== 'boss') return;
        const bossRoom = this._findBossRoom();
        if (!bossRoom) return;
        const bossDead = bossRoom.cleared ?? false;
        const doorOpen = this._isOpen && !this._isAnimating;
        if (this._eyesNode) this._eyesNode.active = !bossDead;
        if (this._lightNode) this._lightNode.active = doorOpen && !bossDead;
    }

    // ── 传送 ──

    private static _lastTeleportTime = 0;

    private _onContact(_self: Collider2D, other: Collider2D): void {
        if (this._pendingIsaac || !this.targetRoom || !this.isaacPrefab) return;
        if (other.group !== 4) return; // PLAYER group
        if (Date.now() - DoorController._lastTeleportTime < 500) return;

        // 钥匙门：战斗中禁止开锁
        if (this.requiresKey && !this._unlocked) {
            if (!this._isRoomSafe()) return;
            if (!GameStats.spendKey(1)) return;
            this._unlocked = true;
            this._animate(true);
            DoorController._lastTeleportTime = Date.now();
            this._pendingIsaac = other.node;
            return;
        }

        if (!this._canTeleport) return;
        DoorController._lastTeleportTime = Date.now();
        this._pendingIsaac = other.node;
    }

    private _doTeleport(oldIsaac: Node): void {
        const targetRoomComp = this.targetRoom!.getComponent("Room") as any;
        if (!targetRoomComp) {
            console.warn("[DoorController] 目标房间缺少 Room 组件");
            return;
        }

        const oldRoomNode = oldIsaac.parent?.parent;
        const oldRoomComp = oldRoomNode?.getComponent?.("Room") as any;
        if (oldRoomComp && oldRoomComp.leave) oldRoomComp.leave();

        oldIsaac.destroy();

        const roomMgr = this.targetRoom!.getChildByName("RoomManager");
        if (!roomMgr) return;

        const newIsaac = instantiate(this.isaacPrefab!);
        roomMgr.addChild(newIsaac);

        const entryDoor = this._findEntryDoor(this.targetRoom!, oldRoomNode);
        newIsaac.setPosition(this._spawnPosAtDoor(entryDoor));

        targetRoomComp.enter();

        const cam = find('Canvas/Camera');
        if (cam) {
            const cc = cam.getComponent('CameraController') as any;
            if (cc) cc.moveToRoom(this.targetRoom!);
        }
    }

    private _findEntryDoor(roomNode: Node, prevRoomNode: Node | null | undefined): Node | null {
        if (!prevRoomNode) return null;
        const doorContainer = roomNode.getChildByName("Door");
        if (!doorContainer) return null;
        for (const doorNode of doorContainer.children) {
            const dc = doorNode.getComponent(DoorController);
            if (dc && dc.targetRoom === prevRoomNode) return doorNode;
        }
        return null;
    }

    private _spawnPosAtDoor(doorNode: Node | null): Vec3 {
        if (!doorNode) return v3(0, 0, 0);
        const p = doorNode.position;
        const d = this.spawnDistance;
        if (Math.abs(p.x) >= Math.abs(p.y)) {
            return v3(p.x + (p.x > 0 ? -d : d), p.y, 0);
        } else {
            return v3(p.x, p.y + (p.y > 0 ? -d : d), 0);
        }
    }
}
