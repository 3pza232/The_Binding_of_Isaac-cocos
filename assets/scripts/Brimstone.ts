import { _decorator, Node, Prefab, instantiate, Vec2, Vec3, Color, Sprite } from 'cc';
import { ItemBase } from './ItemBase';
import { GameState } from './GameState';
import { BrimstoneLaser } from './BrimstoneLaser';
import { AttackType, ROOM_SPACING_X, ROOM_SPACING_Y } from './Constants';

const { ccclass, property } = _decorator;

const ROOM_DIAG = Math.sqrt(ROOM_SPACING_X ** 2 + ROOM_SPACING_Y ** 2);

@ccclass('Brimstone')
export class Brimstone extends ItemBase {

    static chargeTime = 3;
    static laserDuration = 1.5;
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
    chargeTimeProp = 3;

    @property({ displayName: '激光持续(秒)', range: [0.5, 5, 0.5], slide: true })
    laserDurationProp = 1.5;

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
        GameState.i.attackType = AttackType.BRIMSTONE;
    }

    /** 发射激光（由 BrimstoneStrategy 调用，damage 和 color 已经 EffectPipeline 修饰） */
    static fire(
        worldPos: Vec3 | Vec2, dir: Vec2, damage: number, color: Color,
        parent: Node, player: Node,
    ): void {
        if (!Brimstone.headPrefab || !Brimstone.bodyPrefab) return;

        const wx = worldPos.x + dir.x * Brimstone.offsetX;
        const wy = worldPos.y + dir.y * Brimstone.offsetY;
        const pw = player.worldPosition;

        const head = instantiate(Brimstone.headPrefab);
        head.setParent(parent);
        head.setWorldPosition(wx, wy, 0);
        _rotate(head, dir);
        _addLaser(head, damage, color, player, wx - pw.x, wy - pw.y);

        let dist = Brimstone.segmentSize;
        while (dist < ROOM_DIAG) {
            const bx = wx + dir.x * dist;
            const by = wy + dir.y * dist;
            const body = instantiate(Brimstone.bodyPrefab);
            body.setParent(parent);
            body.setWorldPosition(bx, by, 0);
            _rotate(body, dir);
            _addLaser(body, damage, color, player, bx - pw.x, by - pw.y);
            dist += Brimstone.segmentSize;
        }
    }
}

function _addLaser(node: Node, dmg: number, color: Color, player: Node, ox: number, oy: number): BrimstoneLaser {
    const bl = node.getComponent(BrimstoneLaser) || node.addComponent(BrimstoneLaser);
    bl.damage = dmg;
    bl.playerNode = player;
    bl.offsetX = ox;
    bl.offsetY = oy;
    // 应用颜色修饰（DollarBill 等藏品效果；Sprite 在子节点 "Sprite" 上）
    const sp = node.getChildByName('Sprite')?.getComponent(Sprite);
    if (sp) sp.color = color;
    bl.startLaser();
    return bl;
}

function _rotate(node: Node, dir: Vec2): void {
    node.angle = Math.atan2(dir.y, dir.x) * (180 / Math.PI) + 90;
}
