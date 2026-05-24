import { _decorator, Component, Node, Prefab, instantiate, TiledMap, TiledMapAsset, SpriteFrame } from 'cc';
import { Room, RoomType } from './Room';
import { DoorController } from './DoorController';
import { GameState, SaveData } from './GameState';
import { CollectibleUI } from './CollectibleUI';
import { ROOM_SPACING_X, ROOM_SPACING_Y } from './Constants';

const { ccclass, property } = _decorator;

type Direction = 'up' | 'down' | 'left' | 'right';

const DIR_VEC: Record<Direction, [number, number]> = {
    up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0],
};

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

interface RoomData {
    x: number;
    y: number;
    type: RoomType;
    node: Node | null;
    links: Set<string>;
}

@ccclass('MapGenerator')
export class MapGenerator extends Component {

    @property({ type: Prefab, displayName: '房间预制体' })
    roomPrefab: Prefab = null!;

    @property({ type: Prefab, displayName: '玩家预制体' })
    isaacPrefab: Prefab = null!;

    @property({ type: [Prefab], displayName: '怪物预制体池' })
    monsterPrefabs: Prefab[] = [];

    @property({ type: [Prefab], displayName: 'Boss 预制体池' })
    bossPrefabs: Prefab[] = [];

    @property({ type: Prefab, displayName: '藏品祭坛预制体' })
    itemPrefab: Prefab = null!;

    @property({ type: TiledMapAsset, displayName: '普通房地图' })
    normalTmx: TiledMapAsset = null!;

    @property({ type: TiledMapAsset, displayName: '宝箱房地图' })
    treasureTmx: TiledMapAsset = null!;

    @property({ type: TiledMapAsset, displayName: '商店房地图' })
    shopTmx: TiledMapAsset = null!;

    @property({ type: TiledMapAsset, displayName: 'Boss 房地图' })
    bossTmx: TiledMapAsset = null!;

    @property({ displayName: '总房间数' })
    totalRooms = 10;

    @property({ displayName: '最少房间数' })
    minRooms = 8;

    @property({ displayName: '宝箱房数量' })
    treasureRooms = 1;

    @property({ displayName: '商店房数量' })
    shopRooms = 1;

    @property({ displayName: '下一层场景名' })
    nextSceneName = '';

    @property({ displayName: '每房怪物下限' })
    monsterMin = 3;

    @property({ displayName: '每房怪物上限' })
    monsterMax = 6;

    // ── 主流程 ──

    start(): void {
        const gs = GameState.i;
        const saved = gs.shouldContinue ? gs.load() : null;
        gs.shouldContinue = false;

        if (saved) {
            gs.restoreStats(saved.stats);
            gs.collected = new Set(saved.collectedPool);
            gs.bossIntroDone = new Set(saved.bossIntroShown);
            this._loadFromSave(saved);
        } else {
            gs.reset();
            this._generate();
        }
    }

    // ── 读档 ──

    private _loadFromSave(data: SaveData): void {
        const grid = new Map<string, RoomData>();
        const sfMap = this._buildCollectibleSfMap();
        const roomMap = new Map<string, Room>();

        // 1. 实例化全部房间
        for (const rd of data.rooms) {
            const node = instantiate(this.roomPrefab);
            node.setPosition(rd.x * ROOM_SPACING_X, rd.y * ROOM_SPACING_Y, 0);
            const room = node.getComponent(Room);
            if (room) room.roomType = rd.type;
            const tm = node.getComponent(TiledMap);
            if (tm) tm.tmxAsset = this._pickTmx(rd.type);
            const rdData: RoomData = { x: rd.x, y: rd.y, type: rd.type, node, links: new Set(rd.links) };
            grid.set(rd.key, rdData);
            if (room) roomMap.set(rd.key, room);
        }

        // 2. 连门
        for (const rd of data.rooms) {
            const dataA = grid.get(rd.key)!;
            const doorContainer = dataA.node!.getChildByName('Door');
            if (!doorContainer) continue;
            for (const doorNode of doorContainer.children) {
                const dc = doorNode.getComponent(DoorController);
                if (!dc) continue;
                const dir = this._getDoorDir(doorNode);
                if (!dir) continue;
                const [dx, dy] = DIR_VEC[dir];
                const nk = this._key(rd.x + dx, rd.y + dy);
                const target = grid.get(nk);
                if (target && rd.links.includes(nk)) {
                    dc.targetRoom = target.node;
                    dc.requiresKey = target.type === RoomType.TREASURE || target.type === RoomType.SHOP;
                    const linkIdx = rd.links.indexOf(nk);
                    if (linkIdx >= 0 && linkIdx < rd.doorsUnlocked.length) {
                        dc.unlocked = rd.doorsUnlocked[linkIdx];
                    }
                    doorNode.active = true;
                } else {
                    doorNode.active = false;
                }
            }
        }

        // 3. 挂场景
        for (const dataB of grid.values()) this.node.addChild(dataB.node!);

        // 4-8 延迟到下一帧（等 Room.start / DoorController.start 执行完毕）
        this.scheduleOnce(() => {
            for (const rd of data.rooms) {
                const room = roomMap.get(rd.key);
                if (!room) continue;
                room.restoreState(!!rd.cleared, !!rd.itemTaken);
            }

            // 刷实体
            for (const [key, dataB] of grid) {
                const mgr = dataB.node!.getChildByName('RoomManager');
                if (!mgr) continue;
                if (key === data.playerRoom) this._spawnIsaac(mgr);
                const rd = data.rooms.find(r => r.key === key);
                if (dataB.type === RoomType.MONSTER && !rd?.cleared) this._spawnMonsters(mgr);
                if (dataB.type === RoomType.BOSS && !rd?.cleared) this._spawnBoss(mgr);
                if (dataB.type === RoomType.TREASURE && !rd?.itemTaken) {
                    this._spawnCollectible(mgr, this._colPrefs.map(p => p.name));
                }
            }

            // 激活玩家房间
            let playerRoomNode: Node | null = null;
            for (const [key, dataB] of grid) {
                if (key === data.playerRoom) {
                    const room = roomMap.get(key);
                    if (room) room.enter();
                    playerRoomNode = dataB.node!;
                }
            }

            // 移摄像机
            if (playerRoomNode) {
                const cam = this.node.parent?.getChildByName('Camera');
                (cam?.getComponent('CameraController') as any)?.moveToRoom?.(playerRoomNode);
            }

            // 恢复藏品 UI
            const cui = this.node.parent?.parent?.getChildByName('Canvas-UI')
                ?.getChildByName('Collectible_UI')?.getComponent(CollectibleUI);
            if (cui && data.uiItemNames.length > 0) cui.restoreFromNames(data.uiItemNames, sfMap);
        }, 0);
    }

    private get _colPrefs(): Prefab[] {
        return GameState.collectiblePrefabs;
    }

    private _buildCollectibleSfMap(): Map<string, SpriteFrame> {
        const m = new Map<string, SpriteFrame>();
        for (const p of this._colPrefs) {
            const node = instantiate(p);
            const sp = (node.getComponent('cc.Sprite') as any)?.spriteFrame;
            if (sp) m.set(p.name, sp);
            node.destroy();
        }
        return m;
    }

    // ── 程序化生成 ──

    private _generate(): void {
        const grid = new Map<string, RoomData>();

        this._growTree(grid);
        this._placeBoss(grid);
        this._addBranches(grid);

        if (grid.size < this.minRooms) {
            console.warn(`[MapGenerator] 仅生成 ${grid.size} 个房间（目标 ≥ ${this.minRooms}）`);
        }

        this._instantiateRooms(grid);
        this._connectDoors(grid);

        for (const data of grid.values()) {
            this.node.addChild(data.node!);
        }

        this._spawnEntities(grid);
    }

    // ── 树生长 ──

    private _makeRoom(x: number, y: number, type: RoomType): RoomData {
        return { x, y, type, node: null, links: new Set() };
    }

    private _link(a: RoomData, bKey: string, b: RoomData, aKey: string): void {
        a.links.add(bKey);
        b.links.add(aKey);
    }

    private _growTree(grid: Map<string, RoomData>): void {
        const minPath = Math.max(this.minRooms, Math.ceil(this.totalRooms * 0.55));
        grid.set('0,0', this._makeRoom(0, 0, RoomType.START));

        const frontier: string[] = ['0,0'];

        while (grid.size < minPath && frontier.length > 0) {
            const idx = Math.floor(Math.random() * frontier.length);
            const key = frontier[idx];
            const parent = grid.get(key)!;

            const free = DIRS.filter(d => {
                const [dx, dy] = DIR_VEC[d];
                return !grid.has(this._key(parent.x + dx, parent.y + dy));
            });

            if (free.length === 0) {
                frontier.splice(idx, 1);
                continue;
            }

            const [dx, dy] = DIR_VEC[free[Math.floor(Math.random() * free.length)]];
            const nx = parent.x + dx, ny = parent.y + dy;
            const childKey = this._key(nx, ny);
            const child = this._makeRoom(nx, ny, RoomType.MONSTER);
            grid.set(childKey, child);

            this._link(parent, childKey, child, key);
            frontier.push(childKey);

            if (free.length <= 1) frontier.splice(idx, 1);
        }
    }

    private _placeBoss(grid: Map<string, RoomData>): void {
        let bossKey = '';
        let maxDist = -1;
        for (const [key, data] of grid) {
            if (data.type !== RoomType.MONSTER) continue;
            const dist = Math.abs(data.x) + Math.abs(data.y);
            if (dist > maxDist) { maxDist = dist; bossKey = key; }
        }
        const boss = grid.get(bossKey);
        if (boss) boss.type = RoomType.BOSS;
    }

    private _addBranches(grid: Map<string, RoomData>): void {
        let treasuresPlaced = 0;
        let shopsPlaced = 0;
        const remaining = this.totalRooms - grid.size;

        for (let i = 0; i < remaining; i++) {
            let type: RoomType;
            if (treasuresPlaced < this.treasureRooms) {
                type = RoomType.TREASURE;
            } else if (shopsPlaced < this.shopRooms) {
                type = RoomType.SHOP;
            } else {
                type = RoomType.MONSTER;
            }

            const candidates = this._branchCandidates(grid);
            if (candidates.length === 0) break;

            const { parentKey, dir } = candidates[Math.floor(Math.random() * candidates.length)];
            const parent = grid.get(parentKey)!;
            const [dx, dy] = DIR_VEC[dir];
            const nx = parent.x + dx, ny = parent.y + dy;
            const childKey = this._key(nx, ny);

            const child = this._makeRoom(nx, ny, type);
            grid.set(childKey, child);
            this._link(parent, childKey, child, parentKey);

            if (type === RoomType.TREASURE) treasuresPlaced++;
            else if (type === RoomType.SHOP) shopsPlaced++;
        }
    }

    private _branchCandidates(grid: Map<string, RoomData>): { parentKey: string; dir: Direction }[] {
        const result: { parentKey: string; dir: Direction }[] = [];
        const branchable = new Set([RoomType.START, RoomType.MONSTER]);
        for (const [key, data] of grid) {
            if (!branchable.has(data.type)) continue;
            for (const d of DIRS) {
                const [dx, dy] = DIR_VEC[d];
                if (!grid.has(this._key(data.x + dx, data.y + dy))) {
                    result.push({ parentKey: key, dir: d });
                }
            }
        }
        return result;
    }

    // ── 实例化 ──

    private _instantiateRooms(grid: Map<string, RoomData>): void {
        for (const [, data] of grid) {
            const node = instantiate(this.roomPrefab);
            node.setPosition(data.x * ROOM_SPACING_X, data.y * ROOM_SPACING_Y, 0);

            const room = node.getComponent(Room);
            if (room) room.roomType = data.type;

            const tm = node.getComponent(TiledMap);
            if (tm) tm.tmxAsset = this._pickTmx(data.type);

            data.node = node;
        }
    }

    private _pickTmx(type: RoomType): TiledMapAsset | null {
        switch (type) {
            case RoomType.TREASURE: return this.treasureTmx;
            case RoomType.SHOP: return this.shopTmx;
            case RoomType.BOSS: return this.bossTmx;
            default: return this.normalTmx;
        }
    }

    private _connectDoors(grid: Map<string, RoomData>): void {
        for (const [key, data] of grid) {
            const doorContainer = data.node!.getChildByName('Door');
            if (!doorContainer) continue;

            for (const doorNode of doorContainer.children) {
                const dir = this._getDoorDir(doorNode);
                if (!dir) continue;

                const [dx, dy] = DIR_VEC[dir];
                const nk = this._key(data.x + dx, data.y + dy);
                const neighbor = grid.get(nk);

                if (neighbor && data.links.has(nk)) {
                    const dc = doorNode.getComponent(DoorController);
                    if (dc) {
                        dc.targetRoom = neighbor.node;
                        dc.requiresKey = neighbor.type === RoomType.TREASURE || neighbor.type === RoomType.SHOP;
                    }
                    doorNode.active = true;
                } else {
                    doorNode.active = false;
                }
            }
        }
    }

    private _getDoorDir(doorNode: Node): Direction | null {
        const p = doorNode.position;
        if (Math.abs(p.y) > Math.abs(p.x)) return p.y > 0 ? 'up' : 'down';
        if (Math.abs(p.x) > Math.abs(p.y)) return p.x > 0 ? 'right' : 'left';
        return null;
    }

    // ── 刷怪 ──

    private _spawnEntities(grid: Map<string, RoomData>): void {
        const allNames = this._colPrefs.map(p => p.name);

        for (const [, data] of grid) {
            const mgr = data.node!.getChildByName('RoomManager');
            if (!mgr) continue;

            switch (data.type) {
                case RoomType.START:
                    this._spawnIsaac(mgr);
                    break;
                case RoomType.MONSTER:
                    this._spawnMonsters(mgr);
                    break;
                case RoomType.BOSS:
                    this._spawnBoss(mgr);
                    break;
                case RoomType.TREASURE:
                    this._spawnCollectible(mgr, allNames);
                    break;
            }
        }
    }

    private _spawnIsaac(parent: Node): void {
        const node = instantiate(this.isaacPrefab);
        node.setPosition(0, 0, 0);
        parent.addChild(node);
    }

    private _spawnMonsters(parent: Node): void {
        if (this.monsterPrefabs.length === 0) return;
        const count = this.monsterMin + Math.floor(Math.random() * (this.monsterMax - this.monsterMin + 1));
        for (let i = 0; i < count; i++) {
            const prefab = this.monsterPrefabs[Math.floor(Math.random() * this.monsterPrefabs.length)];
            const node = instantiate(prefab);
            node.setPosition((Math.random() - 0.5) * 500, (Math.random() - 0.5) * 300, 0);
            parent.addChild(node);
        }
    }

    private _spawnBoss(parent: Node): void {
        if (this.bossPrefabs.length === 0) return;
        const prefab = this.bossPrefabs[Math.floor(Math.random() * this.bossPrefabs.length)];
        const node = instantiate(prefab);
        node.setPosition(0, 0, 0);
        parent.addChild(node);
    }

    private _spawnCollectible(parent: Node, allNames: string[]): void {
        const gs = GameState.i;
        if (allNames.length > 0 && allNames.every(n => gs.isCollected(n))) {
            gs.collected.clear();
        }

        const available = this._colPrefs.filter(p => !gs.isCollected(p.name));
        if (available.length === 0) return;

        const prefab = available[Math.floor(Math.random() * available.length)];

        const itemNode = instantiate(this.itemPrefab);
        itemNode.setPosition(0, 0, 0);

        const collectNode = instantiate(prefab);
        itemNode.addChild(collectNode);

        parent.addChild(itemNode);
    }

    private _key(x: number, y: number): string {
        return `${x},${y}`;
    }
}
