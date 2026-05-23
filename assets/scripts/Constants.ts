/** 房间网格间距 */
export const ROOM_SPACING_X = 900;
export const ROOM_SPACING_Y = 600;

/** 物理分组 */
export const GROUP = {
    DEFAULT: 1,
    DOOR: 2,
    PLAYER: 4,
    MONSTER: 8,
    WALL: 16,
    TEAR: 32,
    ITEM: 64,
} as const;

/** 默认属性 */
export const DEFAULT_MAX_HP = 6;
export const DEFAULT_MOVE_SPEED = 5;
export const DEFAULT_TEAR_DAMAGE = 3.5;
export const DEFAULT_TEAR_SPEED = 13;
export const DEFAULT_RANGE = 250;
export const DEFAULT_FIRE_RATE = 0.5;
export const DEFAULT_KEYS = 2;

/** 藏品槽上限 */
export const MAX_COLLECTIBLE_SLOTS = 25;
