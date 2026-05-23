import { sys } from 'cc';

const SAVE_KEY = 'isaac_save';

export interface PlayerStatsData {
    hp: number;
    maxHp: number;
    moveSpeed: number;
    tearDamage: number;
    damageMul: number;
    range: number;
    tearSpeed: number;
    fireRate: number;
    homingEnabled: boolean;
    keys: number;
    coins: number;
}

export interface RoomSaveData {
    key: string;
    x: number;
    y: number;
    type: number;
    cleared: boolean;
    itemTaken: boolean;
    /** 与本房间相连的房间 grid key */
    links: string[];
    /** 与 links 一一对应：对应方向的门是否已钥匙解锁 */
    doorsUnlocked: boolean[];
}

export interface SaveData {
    scene: string;
    playerRoom: string;
    stats: PlayerStatsData;
    rooms: RoomSaveData[];
    collectedPool: string[];
    uiItemNames: string[];
    bossIntroShown: string[];
}

export class GameSave {

    static shouldContinue = false;
    static currentData: SaveData | null = null;

    static get hasSave(): boolean {
        return sys.localStorage.getItem(SAVE_KEY) !== null;
    }

    static save(data: SaveData): void {
        sys.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    }

    static load(): SaveData | null {
        const raw = sys.localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw) as SaveData;
            if (!data.scene || !data.rooms) return null;
            return data;
        } catch {
            return null;
        }
    }

    static delete(): void {
        sys.localStorage.removeItem(SAVE_KEY);
        GameSave.currentData = null;
    }

    static clear(): void {
        GameSave.shouldContinue = false;
        GameSave.currentData = null;
    }
}
