import { find, director } from 'cc';
import { Room, RoomType } from './Room';
import { DoorController } from './DoorController';
import { PlayerHealth } from './PlayerHealth';
import { Body } from './Body';
import { Shoot } from './Shoot';
import { GameStats } from './GameStats';
import { CollectibleUI } from './CollectibleUI';
import { CollectiblePool } from './CollectiblePool';
import { BossIntroManager } from './BossIntroManager';
import { SaveData, RoomSaveData, PlayerStatsData } from './GameSave';

const ROOM_SPACING_X = 900;
const ROOM_SPACING_Y = 600;

export class SaveCollector {

    static collect(): SaveData {
        const gm = find('Canvas/GameManager');
        if (!gm) throw new Error('[SaveCollector] GameManager not found');

        // 玩家属性
        const stats: PlayerStatsData = {
            hp: PlayerHealth.hp,
            maxHp: PlayerHealth.maxHp,
            moveSpeed: Body.moveSpeed,
            tearDamage: Shoot.tearDamage,
            damageMul: Shoot.damageMul,
            range: Shoot.range,
            tearSpeed: Shoot.tearSpeed,
            fireRate: Shoot.fireRate,
            homingEnabled: Shoot.homingEnabled,
            keys: GameStats.keys,
            coins: GameStats.coins,
        };

        // 玩家所在房间
        let playerRoom = '0,0';
        const isaac = this._findIsaac(gm);
        if (isaac) {
            const roomNode = this._findContainingRoom(isaac);
            if (roomNode) {
                const gx = Math.round(roomNode.position.x / ROOM_SPACING_X);
                const gy = Math.round(roomNode.position.y / ROOM_SPACING_Y);
                playerRoom = `${gx},${gy}`;
            }
        }

        // 房间状态
        const rooms: RoomSaveData[] = [];
        for (const child of gm.children) {
            const room = child.getComponent(Room);
            if (!room) continue;

            const gx = Math.round(child.position.x / ROOM_SPACING_X);
            const gy = Math.round(child.position.y / ROOM_SPACING_Y);

            const doorContainer = child.getChildByName('Door');
            const links: string[] = [];
            const doorsUnlocked: boolean[] = [];

            if (doorContainer) {
                for (const doorNode of doorContainer.children) {
                    if (!doorNode.active) continue;
                    const dc = doorNode.getComponent(DoorController);
                    if (!dc || !dc.targetRoom) continue;

                    const tgx = Math.round(dc.targetRoom.position.x / ROOM_SPACING_X);
                    const tgy = Math.round(dc.targetRoom.position.y / ROOM_SPACING_Y);
                    links.push(`${tgx},${tgy}`);
                    doorsUnlocked.push(dc.unlocked);
                }
            }

            rooms.push({
                key: `${gx},${gy}`,
                x: gx, y: gy,
                type: room.roomType,
                cleared: room.cleared,
                itemTaken: room.itemTaken,
                links,
                doorsUnlocked,
            });
        }

        // 藏品池
        const collectedPool = CollectiblePool.getCollected();

        // 藏品栏
        const cui = find('Canvas-UI/Collectible_UI')?.getComponent(CollectibleUI);
        const uiItemNames = cui ? cui.getItemNames() : [];

        // Boss 入场 — 用 grid key 而非节点 UUID
        const bossIntroShown: string[] = [];
        for (const child of gm.children) {
            const room = child.getComponent(Room);
            if (room && room.roomType === RoomType.BOSS) {
                const gx = Math.round(child.position.x / ROOM_SPACING_X);
                const gy = Math.round(child.position.y / ROOM_SPACING_Y);
                const gridKey = `${gx},${gy}`;
                if (BossIntroManager._clearedRooms.has(gridKey)) {
                    bossIntroShown.push(gridKey);
                }
            }
        }

        return {
            scene: director.getScene()!.name,
            playerRoom,
            stats,
            rooms,
            collectedPool,
            uiItemNames,
            bossIntroShown,
        };
    }

    private static _findIsaac(gm: any): any {
        for (const child of gm.children) {
            const mgr = child.getChildByName('RoomManager');
            if (mgr) {
                const isaac = mgr.getChildByName('Isaac');
                if (isaac) return isaac;
            }
        }
        return null;
    }

    private static _findContainingRoom(node: any): any {
        let n = node.parent;
        while (n) {
            if (n.getComponent(Room)) return n;
            n = n.parent;
        }
        return null;
    }
}
