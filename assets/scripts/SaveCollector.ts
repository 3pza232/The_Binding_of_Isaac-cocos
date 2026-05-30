import { find, director, Node } from "cc";
import { Room, RoomType } from "./Room";
import { DoorController } from "./DoorController";
import { CollectibleUI } from "./CollectibleUI";
import { ItemBase } from "./ItemBase";
import { DropPickup, DropType } from "./DropPickup";
import { GameState, SaveData, DropSaveData, PlayerStatsData, RoomSaveData } from "./GameState";
import { ROOM_SPACING_X, ROOM_SPACING_Y } from "./Constants";

export class SaveCollector {
    static collect(): SaveData {
        const gm = find("Canvas/GameManager");
        if (!gm) throw new Error("[SaveCollector] GameManager not found");

        const gs = GameState.i;

        const stats: PlayerStatsData = {
            hp: gs.hp,
            maxHp: gs.maxHp,
            moveSpeed: gs.moveSpeed,
            tearDamage: gs.tearDamage,
            damageMul: gs.damageMul,
            range: gs.range,
            tearSpeed: gs.tearSpeed,
            fireRate: gs.fireRate,
            homingEnabled: gs.homing,
            laserHomingEnabled: gs.laserHoming,
            enemyPiercing: gs.enemyPiercing,
            wallPiercing: gs.wallPiercing,
            brimstone: gs.brimstone,
            dollarBill: gs.dollarBill,
            keys: gs.keys,
            coins: gs.coins,
        };

        // 玩家所在房间及房间内坐标
        let playerRoom = "0,0";
        let playerRoomX = 0;
        let playerRoomY = 0;
        const isaac = _findIsaac(gm);
        if (isaac) {
            const roomNode = _findContainingRoom(isaac);
            if (roomNode) {
                const gx = Math.round(roomNode.position.x / ROOM_SPACING_X);
                const gy = Math.round(roomNode.position.y / ROOM_SPACING_Y);
                playerRoom = `${gx},${gy}`;
                playerRoomX = isaac.position.x;
                playerRoomY = isaac.position.y;
            }
        }

        // 房间状态
        const rooms: RoomSaveData[] = [];
        for (const child of gm.children) {
            const room = child.getComponent(Room);
            if (!room) continue;

            const gx = Math.round(child.position.x / ROOM_SPACING_X);
            const gy = Math.round(child.position.y / ROOM_SPACING_Y);

            const doorContainer = child.getChildByName("Door");
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

            // 藏品名列表（ItemBase 在 pedestal 的所有子节点中查找）
            const collectiblePrefabNames: string[] = [];
            const shouldSaveCollectible =
                room.roomType === RoomType.TREASURE ||
                room.roomType === RoomType.SHOP ||
                (room.roomType === RoomType.BOSS && room.cleared && !room.itemTaken);
            if (shouldSaveCollectible) {
                const mgr = child.getChildByName("RoomManager");
                if (mgr) {
                    for (const itemNode of mgr.children) {
                        for (const childNode of itemNode.children) {
                            const ib = childNode.getComponent(ItemBase);
                            if (ib) {
                                collectiblePrefabNames.push(childNode.name);
                                break;
                            }
                        }
                    }
                }
            }

            // 掉落物
            const drops: DropSaveData[] = [];
            const mgr = child.getChildByName("RoomManager");
            if (mgr) {
                for (const dropNode of mgr.children) {
                    const dp = dropNode.getComponent(DropPickup);
                    if (dp) {
                        drops.push({
                            type: dp.type === DropType.COIN ? "coin" : "key",
                            x: dropNode.position.x,
                            y: dropNode.position.y,
                            amount: dp.amount,
                        });
                    }
                }
            }

            rooms.push({
                key: `${gx},${gy}`,
                x: gx,
                y: gy,
                type: room.roomType,
                cleared: room.cleared,
                itemTaken: room.itemTaken,
                links,
                doorsUnlocked,
                collectiblePrefabNames,
                drops,
            });
        }

        // Boss 入场 — 用 grid key
        const bossIntroShown: string[] = [];
        for (const child of gm.children) {
            const room = child.getComponent(Room);
            if (room && room.roomType === RoomType.BOSS) {
                const gx = Math.round(child.position.x / ROOM_SPACING_X);
                const gy = Math.round(child.position.y / ROOM_SPACING_Y);
                const gridKey = `${gx},${gy}`;
                if (gs.bossIntroDone.has(gridKey)) {
                    bossIntroShown.push(gridKey);
                }
            }
        }

        // 藏品栏
        const cui = find("Canvas-UI/Collectible_UI")?.getComponent(CollectibleUI);
        const uiItemNames = cui ? cui.getItemNames() : [];

        return {
            scene: director.getScene()!.name,
            playerRoom,
            playerRoomX,
            playerRoomY,
            stats,
            rooms,
            collectedPool: [...gs.collected],
            uiItemNames,
            bossIntroShown,
        };
    }
}

function _findIsaac(gm: Node): Node | null {
    for (const child of gm.children) {
        const mgr = child.getChildByName("RoomManager");
        if (mgr) {
            const isaac = mgr.getChildByName("Isaac");
            if (isaac) return isaac;
        }
    }
    return null;
}

function _findContainingRoom(node: Node): Node | null {
    let n: Node | null = node.parent;
    while (n) {
        if (n.getComponent(Room)) return n;
        n = n.parent;
    }
    return null;
}
