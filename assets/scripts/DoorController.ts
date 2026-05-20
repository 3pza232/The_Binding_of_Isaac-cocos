import {
    _decorator,
    Component,
    Node,
    UITransform,
    Sprite,
    Collider2D,
    Contact2DType,
    Prefab,
    instantiate,
    find,
    tween,
    v3,
    Vec3,
    Tween,
} from "cc";

const { ccclass, property } = _decorator;

/**
 * 门控制组件，挂载于 Door 节点。
 * 门板向门轴压缩的开关门动画 + 碰撞传送玩家到目标房间。
 * 门开关状态由 Room 组件控制，本组件只负责动画与传送。
 */
@ccclass("DoorController")
export class DoorController extends Component {
    // ── 属性 ──

    @property({ displayName: "动画时长(秒)" })
    animationDuration = 0.5;

    @property({ type: Node, displayName: "目标房间" })
    targetRoom: Node | null = null;

    @property({ type: Prefab, displayName: "玩家" })
    isaacPrefab: Prefab | null = null;

    @property({ displayName: "门边生成距离(px)" })
    spawnDistance = 50;

    // ── 内部状态 ──

    private _isOpen = false;
    private _isAnimating = false;
    private _canTeleport = false;
    private _pendingIsaac: Node | null = null;

    private _leftPanel: Node | null = null;
    private _rightPanel: Node | null = null;
    private _leftOrigW = 0;
    private _rightOrigW = 0;
    private _anchorsApplied = false;

    // Boss 门专属
    private _eyesNode: Node | null = null;
    private _lightNode: Node | null = null;

    // ── 生命周期 ──

    start(): void {
        this._leftPanel = this.node.getChildByName("LeftPanel");
        this._rightPanel = this.node.getChildByName("RightPanel");

        if (this._leftPanel) this._leftOrigW = this._leftPanel.getComponent(UITransform)!.width;
        if (this._rightPanel) this._rightOrigW = this._rightPanel.getComponent(UITransform)!.width;

        this._eyesNode = this.node.getChildByName("Eyes");
        this._lightNode = this.node.getChildByName("Light");

        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
        }
    }

    update(_dt: number): void {
        if (this._pendingIsaac) {
            this._doTeleport(this._pendingIsaac);
            this._pendingIsaac = null;
        }
        this._syncBossVisuals();
    }

    // ── Public API ──

    open(): void {
        this._animate(true);
    }

    close(): void {
        this._animate(false);
    }

    /** 短暂禁用传送（玩家进门后防止入口门弹回） */
    briefCooldown(): void {
        this._canTeleport = false;
        this.scheduleOnce(() => {
            this._canTeleport = this._isOpen && !this._isAnimating;
        }, 0.5);
    }

    // ── 动画：门板向门轴压缩 ──

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

    // ── Boss 门视觉 ──

    /** 查找与本门关联的 Boss 房间：优先 targetRoom，其次门自身所在的房间 */
    private _findBossRoom(): any {
        // 外侧门：targetRoom 是 Boss 房
        if (this.targetRoom) {
            const r = this.targetRoom.getComponent("Room") as any;
            if (r && r.roomType === 4) return r;
        }
        // 内侧门：门自身所在房间是 Boss 房
        let node = this.node.parent;
        while (node) {
            const r = node.getComponent("Room") as any;
            if (r && r.roomType === 4) return r;
            node = node.parent;
        }
        return null;
    }

    private _syncBossVisuals(): void {
        if (!this._eyesNode && !this._lightNode) return;

        const bossRoom = this._findBossRoom();
        if (!bossRoom) return;

        const bossDead = bossRoom.cleared ?? false;
        const doorOpen = this._isOpen && !this._isAnimating;

        if (this._eyesNode) this._eyesNode.active = !bossDead;
        if (this._lightNode) this._lightNode.active = doorOpen && !bossDead;
    }

    // ── 传送 ──

    private _onContact(_self: Collider2D, other: Collider2D): void {
        if (!this._canTeleport || this._pendingIsaac || !this.targetRoom || !this.isaacPrefab)
            return;
        if (other.group !== 4) return; // PLAYER
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

        // 在目标房间中找到连接回上一个房间的门，在其内侧生成
        const entryDoor = this._findEntryDoor(this.targetRoom!, oldRoomNode);
        newIsaac.setPosition(this._spawnPosAtDoor(entryDoor));

        // 入口门短暂冷却，防止新 Isaac 立即碰撞弹回
        if (entryDoor) {
            const entryDC = entryDoor.getComponent(DoorController);
            if (entryDC) entryDC.briefCooldown();
        }

        targetRoomComp.enter();

        const gm = find("Canvas/GameManager");
        if (gm) {
            const rp = this.targetRoom!.position;
            gm.setPosition(-rp.x, -rp.y, gm.position.z);
        }
    }

    /** 在 roomNode 中查找 targetRoom 指回 prevRoomNode 的门 */
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

    /** 在门内侧 spawnDistance 像素处生成 */
    private _spawnPosAtDoor(doorNode: Node | null): Vec3 {
        if (!doorNode) return v3(0, 0, 0);

        const p = doorNode.position;
        const d = this.spawnDistance;

        // 根据门在房间中的位置判断所在墙壁，向房间内侧偏移
        if (Math.abs(p.x) >= Math.abs(p.y)) {
            // 左/右墙：x 向房间中心偏移
            return v3(p.x + (p.x > 0 ? -d : d), p.y, 0);
        } else {
            // 上/下墙：y 向房间中心偏移
            return v3(p.x, p.y + (p.y > 0 ? -d : d), 0);
        }
    }
}
