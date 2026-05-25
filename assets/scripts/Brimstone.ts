import { _decorator, Node, Prefab, instantiate, Vec2, Vec3 } from 'cc';
import { ItemBase } from './ItemBase';
import { GameState } from './GameState';
import { BrimstoneLaser } from './BrimstoneLaser';
import { DollarBill } from './DollarBill';
import { ROOM_SPACING_X, ROOM_SPACING_Y } from './Constants';

const { ccclass, property } = _decorator;

const ROOM_DIAG = Math.sqrt(ROOM_SPACING_X ** 2 + ROOM_SPACING_Y ** 2);

@ccclass('Brimstone')
export class Brimstone extends ItemBase {

    // ── 效果参数（onPickup 时从实例注入静态）──

    static chargeTime = 4;
    static laserDuration = 2;
    static tickRate = 4;
    static fadeTime = 0.3;
    static headPrefab: Prefab | null = null;
    static bodyPrefab: Prefab | null = null;
    static segmentSize = 64;
    static offsetX = 5;
    static offsetY = 5;

    @property({ displayName: '水平发射偏移' })
    offsetXProp = 5;

    @property({ displayName: '垂直发射偏移' })
    offsetYProp = 5;

    @property({ displayName: '蓄力时长(秒)', range: [1, 8, 0.5], slide: true })
    chargeTimeProp = 4;

    @property({ displayName: '激光持续(秒)', range: [0.5, 5, 0.5], slide: true })
    laserDurationProp = 2;

    @property({ displayName: '伤害频率(次/秒)', range: [1, 30, 1] })
    tickRateProp = 4;

    @property({ displayName: '淡出时间(秒)', range: [0.1, 1, 0.1], slide: true })
    fadeTimeProp = 0.3;

    @property({ type: Prefab, displayName: '激光头预制体' })
    headPrefab: Prefab | null = null;

    @property({ type: Prefab, displayName: '激光体预制体' })
    bodyPrefab: Prefab | null = null;

    @property({ displayName: '激光段间距' })
    segmentSize = 64;

    protected onPickup(_player: Node): void {
        Brimstone.chargeTime = this.chargeTimeProp;
        Brimstone.laserDuration = this.laserDurationProp;
        Brimstone.tickRate = this.tickRateProp;
        Brimstone.fadeTime = this.fadeTimeProp;
        Brimstone.headPrefab = this.headPrefab;
        Brimstone.bodyPrefab = this.bodyPrefab;
        Brimstone.segmentSize = this.segmentSize;
        Brimstone.offsetX = this.offsetXProp;
        Brimstone.offsetY = this.offsetYProp;
        GameState.i.brimstone = true;
    }

    // ── 发射激光 ──

    static fire(worldPos: Vec3 | Vec2, dir: Vec2, parent: Node, player: Node): void {
        if (!Brimstone.headPrefab || !Brimstone.bodyPrefab) return;

        const gs = GameState.i;
        const dmg = Math.max(1, gs.tearDamage * gs.damageMul + (DollarBill.active ? DollarBill.dmg : 0));
        const wx = ('x' in worldPos ? (worldPos as Vec2).x : (worldPos as Vec3).x) + dir.x * Brimstone.offsetX;
        const wy = ('x' in worldPos ? (worldPos as Vec2).y : (worldPos as Vec3).y) + dir.y * Brimstone.offsetY;
        const pw = player.worldPosition;

        const head = instantiate(Brimstone.headPrefab);
        head.setParent(parent);
        head.setWorldPosition(wx, wy, 0);
        _rotate(head, dir);
        _addLaser(head, dmg, player, wx - pw.x, wy - pw.y);

        let dist = Brimstone.segmentSize;
        while (dist < ROOM_DIAG) {
            const bx = wx + dir.x * dist;
            const by = wy + dir.y * dist;
            const body = instantiate(Brimstone.bodyPrefab);
            body.setParent(parent);
            body.setWorldPosition(bx, by, 0);
            _rotate(body, dir);
            _addLaser(body, dmg, player, bx - pw.x, by - pw.y);
            dist += Brimstone.segmentSize;
        }
    }
}

function _addLaser(node: Node, dmg: number, player: Node, ox: number, oy: number): BrimstoneLaser {
    const bl = node.getComponent(BrimstoneLaser) || node.addComponent(BrimstoneLaser);
    bl.damage = dmg;
    bl.playerNode = player;
    bl.offsetX = ox;
    bl.offsetY = oy;
    bl.startLaser();
    return bl;
}

function _rotate(node: Node, dir: Vec2): void {
    node.angle = Math.atan2(dir.y, dir.x) * (180 / Math.PI) + 90;
}
