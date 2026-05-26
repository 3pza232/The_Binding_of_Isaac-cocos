import { _decorator, Component, Node, Prefab, instantiate, TiledMap, TiledMapAsset, SpriteFrame, AudioClip, AudioSource } from 'cc';
import { ShopItem } from './ShopItem';
import { Room, RoomType } from './Room';
import { DoorController } from './DoorController';
import { GameState, SaveData } from './GameState';
import { CollectibleUI } from './CollectibleUI';
import { EffectPipeline } from './EffectPipeline';
import { ItemBase } from './ItemBase';
import { DropPickup } from './DropPickup';
import { LaserTracker } from './LaserTracker';
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

    @property({ displayName: '商店商品数量' })
    shopItemCount = 2;

    @property({ type: TiledMapAsset, displayName: 'Boss 房地图' })
    bossTmx: TiledMapAsset = null!;

    @property({ displayName: '总房间数', tooltip: '怪物房（含初始房）数量，Boss 会替换其中一间，宝箱/商店房额外追加' })
    totalRooms = 10;

    @property({ displayName: '最少怪物房数', tooltip: '低于此数会报警，纯提示' })
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

    @property({ type: AudioClip, displayName: '游戏背景音乐' })
    gameBgm: AudioClip | null = null;

    @property({ type: AudioClip, displayName: 'Boss房音乐' })
    bossBgm: AudioClip | null = null;

    @property({ displayName: '音乐音量', range: [0, 1, 0.05], slide: true })
    bgmVolume = 0.6;

    /** 本轮生成已分配的藏品名，避免同一层多个宝箱房刷出重复藏品 */
    private _assignedThisRun = new Set<string>();

    // ── 主流程 ──

    start(): void {
        const gs = GameState.i;
        const saved = gs.shouldContinue ? gs.load() : null;
        gs.shouldContinue = false;

        if (saved) {
            gs.collected = new Set(saved.collectedPool);
            gs.bossIntroDone = new Set(saved.bossIntroShown);
            this._restoreCollectibleEffects();
            gs.restoreStats(saved.stats);
            this._loadFromSave(saved);
        } else if (gs.sceneTransitioning) {
            gs.sceneTransitioning = false;
            gs.bossIntroDone.clear();
            this._generate();
            this.scheduleOnce(() => this._restoreCollectibleUI(), 0);
        } else {
            gs.reset();
            this._generate();
        }

        // 场景背景音乐（loop）
        if (this.gameBgm) {
            const src = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
            src.clip = this.gameBgm;
            src.loop = true;
            src.volume = this.bgmVolume;
            src.play();
        }
    }

    /** 切入 Boss 音乐（Room.enter 调用） */
    playBossMusic(): void {
        if (!this.bossBgm) return;
        const src = this.node.getComponent(AudioSource);
        if (!src) return;
        src.stop();
        src.clip = this.bossBgm;
        src.loop = true;
        src.volume = this.bgmVolume;
        src.play();
    }

    /** Boss 战结束切回主音乐（Room._setCleared 调用） */
    playMainMusic(): void {
        if (!this.gameBgm) return;
        const src = this.node.getComponent(AudioSource);
        if (!src) return;
        src.stop();
        src.clip = this.gameBgm;
        src.loop = true;
        src.volume = this.bgmVolume;
        src.play();
    }

    /** 读档后恢复全部已收集道具的效果（临时实例化调用 onPickup，restoreStats 随后覆盖属性值）。
     *  注意：不修改 gs.collected，因为 restoreStats 之前已从存档恢复了 collected 集合。 */
    private _restoreCollectibleEffects(): void {
        EffectPipeline.clear();
        LaserTracker.clearBendModifiers();
        GameState.i.clearEffects();

        const gs = GameState.i;
        for (const name of gs.collected) {
            const prefab = GameState.collectiblePrefabs.find(p => p.name === name);
            if (!prefab) continue;
            const node = instantiate(prefab);
            const item = node.getComponent(ItemBase);
            if (item) (item as any).onPickup(null);
            node.destroy();
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
                const rd = data.rooms.find(r => r.key === key);

                if (key === data.playerRoom) {
                    this._spawnIsaac(mgr);
                    const isaac = mgr.getChildByName('Isaac');
                    if (isaac) isaac.setPosition(data.playerRoomX, data.playerRoomY, 0);
                }
                if (dataB.type === RoomType.MONSTER && !rd?.cleared) this._spawnMonsters(mgr);
                if (dataB.type === RoomType.BOSS && !rd?.cleared) this._spawnBoss(mgr);
                if (dataB.type === RoomType.TREASURE && !rd?.itemTaken) {
                    if (rd?.collectiblePrefabNames?.length) {
                        this._spawnCollectibleByName(mgr, rd.collectiblePrefabNames[0]);
                    } else {
                        this._spawnCollectible(mgr, this._colPrefs.map(p => p.name));
                    }
                }
                // Boss 击败后未捡的藏品
                if (dataB.type === RoomType.BOSS && rd?.cleared && !rd?.itemTaken && rd?.collectiblePrefabNames?.length) {
                    this._spawnCollectibleByName(mgr, rd.collectiblePrefabNames[0]);
                }
                if (dataB.type === RoomType.SHOP) {
                    if (rd?.collectiblePrefabNames?.length) {
                        this._spawnShopFromSave(mgr, rd.collectiblePrefabNames);
                    } else {
                        this._spawnShop(mgr);
                    }
                }
                // 生成掉落物
                if (rd?.drops && rd.drops.length > 0) {
                    this._spawnDropsFromSave(mgr, rd.drops);
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

    /** 场景过渡后恢复藏品栏 UI（从 gs.collected 重建） */
    private _restoreCollectibleUI(): void {
        const gs = GameState.i;
        if (gs.collected.size === 0) return;
        const sfMap = this._buildCollectibleSfMap();
        const cui = this.node.parent?.parent?.getChildByName('Canvas-UI')
            ?.getChildByName('Collectible_UI')?.getComponent(CollectibleUI);
        if (cui) cui.restoreFromNames([...gs.collected], sfMap);
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
        this._assignedThisRun.clear();
        const grid = new Map<string, RoomData>();

        this._growTree(grid);
        this._placeBoss(grid);
        this._addSpecialRooms(grid);

        if (grid.size - 1 < this.minRooms) {  // -1: BOSS 为额外房间
            const monsterCount = grid.size - 1 - this.treasureRooms - this.shopRooms;
            console.warn(`[MapGenerator] 怪物房仅 ${monsterCount} 间（目标 ≥ ${this.minRooms}）`);
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
        grid.set('0,0', this._makeRoom(0, 0, RoomType.START));
        const target = this.totalRooms;
        const frontier: string[] = ['0,0'];

        while (grid.size < target && frontier.length > 0) {
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

    /** 在最远树叶 MONSTER 房旁新增 Boss 房（保证 Boss 只有一扇门） */
    private _placeBoss(grid: Map<string, RoomData>): void {
        let parentKey = '';
        let maxDist = -1;
        for (const [key, data] of grid) {
            if (data.type !== RoomType.MONSTER || data.links.size !== 1) continue;
            const dist = Math.abs(data.x) + Math.abs(data.y);
            if (dist > maxDist) { maxDist = dist; parentKey = key; }
        }
        if (!parentKey) return;

        const parent = grid.get(parentKey)!;
        const dirs = DIRS.filter(d => {
            const [dx, dy] = DIR_VEC[d];
            return !grid.has(this._key(parent.x + dx, parent.y + dy));
        });
        if (dirs.length === 0) return;

        const [dx, dy] = DIR_VEC[dirs[Math.floor(Math.random() * dirs.length)]];
        const bossKey = this._key(parent.x + dx, parent.y + dy);
        const boss = this._makeRoom(parent.x + dx, parent.y + dy, RoomType.BOSS);
        grid.set(bossKey, boss);
        this._link(parent, bossKey, boss, parentKey);
    }

    /** 追加宝箱房 / 商店房到树叶末端（额外房间，不计入 totalRooms） */
    private _addSpecialRooms(grid: Map<string, RoomData>): void {
        const toPlace: RoomType[] = [];
        for (let i = 0; i < this.treasureRooms; i++) toPlace.push(RoomType.TREASURE);
        for (let i = 0; i < this.shopRooms; i++) toPlace.push(RoomType.SHOP);

        for (const type of toPlace) {
            const cands = this._branchCandidates(grid);
            if (cands.length === 0) {
                console.warn(`[MapGenerator] 无法放置 ${RoomType[type]}：无空闲相邻格`);
                continue;
            }
            const { parentKey, dir } = cands[0];
            const parent = grid.get(parentKey)!;
            const [dx, dy] = DIR_VEC[dir];
            const childKey = this._key(parent.x + dx, parent.y + dy);
            const child = this._makeRoom(parent.x + dx, parent.y + dy, type);
            grid.set(childKey, child);
            this._link(parent, childKey, child, parentKey);
        }
    }

    /** 候选：父是 MONSTER/START，叶子节点（链接数少）优先 */
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
        result.sort((a, b) => (grid.get(a.parentKey)?.links.size ?? 99) - (grid.get(b.parentKey)?.links.size ?? 99));
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
        for (const [, data] of grid) {
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
                case RoomType.SHOP:
                    this._spawnShop(mgr);
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
        if (allNames.length > 0 && allNames.every(n => gs.isCollected(n) || this._assignedThisRun.has(n))) {
            gs.collected.clear();
            this._assignedThisRun.clear();
        }

        const available = this._colPrefs.filter(p => !gs.isCollected(p.name) && !this._assignedThisRun.has(p.name));
        if (available.length === 0) return;

        const prefab = available[Math.floor(Math.random() * available.length)];
        this._assignedThisRun.add(prefab.name);

        const itemNode = instantiate(this.itemPrefab);
        itemNode.setPosition(0, 0, 0);

        const collectNode = instantiate(prefab);
        itemNode.addChild(collectNode);

        parent.addChild(itemNode);
    }

    private _spawnShop(parent: Node): void {
        const gs = GameState.i;

        const spacing = 120;
        const startX = -(this.shopItemCount - 1) * spacing / 2;

        for (let i = 0; i < this.shopItemCount; i++) {
            // 每格重新过滤：排除已收集 + 本层已分配（含前面格子刚选的）
            let pool = this._colPrefs.filter(
                p => !gs.isCollected(p.name) && !this._assignedThisRun.has(p.name),
            );
            // 去重后不够 → 退到仅排除已收集（允许本层重复）
            if (pool.length === 0) {
                pool = this._colPrefs.filter(p => !gs.isCollected(p.name));
            }
            if (pool.length === 0) break;

            const prefab = pool[Math.floor(Math.random() * pool.length)];
            this._assignedThisRun.add(prefab.name);

            const itemNode = instantiate(this.itemPrefab);
            itemNode.setPosition(startX + i * spacing, 0, 0);

            const collectNode = instantiate(prefab);
            itemNode.addChild(collectNode);

            itemNode.getComponent(ShopItem)!.initShop();

            parent.addChild(itemNode);
        }
    }

    /** 按名称数组生成商店藏品（读档用） */
    private _spawnShopFromSave(parent: Node, names: string[]): void {
        const spacing = 120;
        const startX = -(names.length - 1) * spacing / 2;

        for (let i = 0; i < names.length; i++) {
            const prefab = this._colPrefs.find(p => p.name === names[i]);
            if (!prefab) continue;
            this._assignedThisRun.add(names[i]);

            const itemNode = instantiate(this.itemPrefab);
            itemNode.setPosition(startX + i * spacing, 0, 0);

            const collectNode = instantiate(prefab);
            itemNode.addChild(collectNode);

            itemNode.getComponent(ShopItem)!.initShop();

            parent.addChild(itemNode);
        }
    }

    /** Boss 击败后掉落一个免费藏品（Room._setCleared 调用） */
    spawnBossDrop(roomNode: Node): void {
        const gs = GameState.i;
        const pool = this._colPrefs.filter(
            p => !gs.isCollected(p.name) && !this._assignedThisRun.has(p.name),
        );
        if (pool.length === 0) return;

        const prefab = pool[Math.floor(Math.random() * pool.length)];
        this._assignedThisRun.add(prefab.name);

        const mgr = roomNode.getChildByName('RoomManager');
        if (!mgr) return;

        const itemNode = instantiate(this.itemPrefab);
        itemNode.setPosition(0, 0, 0);

        const collectNode = instantiate(prefab);
        itemNode.addChild(collectNode);

        mgr.addChild(itemNode);
    }

    /** 按名称生成指定藏品（读档用） */
    private _spawnCollectibleByName(parent: Node, name: string): void {
        const prefab = this._colPrefs.find(p => p.name === name);
        if (!prefab) return;
        this._assignedThisRun.add(name);

        const itemNode = instantiate(this.itemPrefab);
        itemNode.setPosition(0, 0, 0);

        const collectNode = instantiate(prefab);
        itemNode.addChild(collectNode);

        parent.addChild(itemNode);
    }

    /** 按存档数据生成掉落物（读档用） */
    private _spawnDropsFromSave(mgr: Node, drops: { type: 'coin' | 'key'; x: number; y: number; amount: number }[]): void {
        const room = mgr.parent?.getComponent(Room);
        if (!room) return;
        for (const d of drops) {
            const prefab = d.type === 'coin' ? room.coinPrefab : room.keyPrefab;
            if (!prefab) continue;
            const node = instantiate(prefab);
            node.setPosition(d.x, d.y, 0);
            const dp = node.getComponent(DropPickup);
            if (dp) dp.amount = d.amount;
            mgr.addChild(node);
        }
    }

    private _key(x: number, y: number): string {
        return `${x},${y}`;
    }
}
