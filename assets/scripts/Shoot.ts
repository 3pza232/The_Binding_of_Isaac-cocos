import {
    _decorator, Component, Node, Prefab, instantiate,
    AudioClip, AudioSource, Vec2, Vec3, Sprite,
} from 'cc';
import { Head } from './Head';
import { Body } from './Body';
import { Tear } from './Tear';
import { GameState } from './GameState';
import { DollarBill } from './DollarBill';
import { Brimstone } from './Brimstone';

const { ccclass, property } = _decorator;

enum S { IDLE, CHARGING, LASER }

@ccclass('Shoot')
export class Shoot extends Component {

    @property({ type: Prefab, displayName: '泪弹预制体' })
    tearPrefab: Prefab = null!;

    @property({ displayName: '泪弹速度' })
    private _tearSpeed = 13;

    @property({ displayName: '射程' })
    private _range = 250;

    @property({ displayName: '射速间隔(秒)' })
    private _fireRate = 0.5;

    @property({ displayName: '下降起始比例', range: [0, 1, 0.05], slide: true })
    fallStartRatio = 0.6;

    @property({ displayName: '水平下落速度' })
    fallSpeed = 5;

    @property({ displayName: '水平发射偏移' })
    spawnOffsetX = 5;

    @property({ displayName: '垂直发射偏移' })
    spawnOffsetY = 5;

    @property({ displayName: '穿墙' })
    piercing = false;

    @property({ displayName: '甩弹比例', range: [0, 1, 0.01], slide: true })
    momentumFactor = 0.1;

    @property({ displayName: '泪弹伤害' })
    private _tearDamage = 3.5;

    @property({ displayName: '伤害倍率' })
    private _damageMul = 1.0;

    @property({ type: AudioClip, displayName: '射击音效' })
    fireSound: AudioClip | null = null;

    @property({ displayName: '射击音量', range: [0, 1, 0.05], slide: true })
    fireVolume = 1;

    @property({ type: AudioClip, displayName: '破裂音效' })
    breakSound: AudioClip | null = null;

    @property({ displayName: '破裂音量', range: [0, 1, 0.05], slide: true })
    breakVolume = 1;

    private _head: Head = null!;
    private _body: Body = null!;
    private _headNode: Node = null!;
    private _audioSrc: AudioSource = null!;
    private _spawnPos = new Vec3();
    private _cooldown = 0;

    // 硫磺火蓄力
    private _brimState = S.IDLE;
    private _brimCharge = 0;
    private _brimLaserTimer = 0;
    private _brimFired = false;

    onLoad(): void {
        const gs = GameState.i;
        if (gs.tearDamage < 0) {
            gs.tearDamage = this._tearDamage;
            gs.damageMul = this._damageMul;
            gs.range = this._range;
            gs.tearSpeed = this._tearSpeed;
            gs.fireRate = this._fireRate;
        }
        this._head = this.node.getComponent(Head)!;
        this._body = this.node.getComponent(Body)!;
        this._headNode = this.node.getChildByName('Head')!;
        this._audioSrc = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);

        // 跨房间蓄力状态恢复
        this._brimState = gs.brimState;
        this._brimCharge = gs.brimCharge;
        this._brimFired = gs.brimFired;
        this._brimLaserTimer = gs.brimLaserTimer;
    }

    onDestroy(): void {
        // 离开房间时保存蓄力状态
        const gs = GameState.i;
        gs.brimState = this._brimState;
        gs.brimCharge = this._brimCharge;
        gs.brimFired = this._brimFired;
        gs.brimLaserTimer = this._brimLaserTimer;
    }

    update(dt: number): void {
        const gs = GameState.i;
        gs.tickEffects(dt);

        // 硫磺火蓄力状态机
        if (gs.brimstone) {
            this._brimUpdate(dt);
            if (this._brimState !== S.IDLE) return; // 蓄力/激光期间禁止普通射击
        }

        this._cooldown -= dt;
        if (this._cooldown > 0) return;

        const dir = this._head.aimDirection;
        if (!dir) return;

        this._cooldown = gs.fireRate;
        this._spawnTear(dir);
    }

    private _brimUpdate(dt: number): void {
        const head = this._head;

        // 全键松开时清除防重蓄标记
        if (head.fireDir !== null) this._brimFired = false;

        switch (this._brimState) {
            case S.IDLE:
                if (!this._brimFired && head.fireDir === null && head.aimDirection) {
                    this._brimState = S.CHARGING;
                    this._brimCharge = 0;
                    GameState.i.brimCharged = false;
                }
                break;

            case S.CHARGING:
                if (head.fireDir !== null) {
                    if (this._brimCharge >= Brimstone.chargeTime || GameState.i.brimCharged) {
                        GameState.i.brimCharged = false;
                        this._brimState = S.LASER;
                        this._brimLaserTimer = Brimstone.laserDuration + Brimstone.fadeTime;
                        this._brimFired = true;
                        Brimstone.fire(this.node.worldPosition, head.fireDir, this.node.parent!, this.node);
                    } else {
                        this._brimState = S.IDLE;
                    }
                } else if (head.aimDirection) {
                    this._brimCharge += dt;
                    if (this._brimCharge >= Brimstone.chargeTime) {
                        GameState.i.brimCharged = true;
                    }
                } else {
                    this._brimState = S.IDLE;
                }
                break;

            case S.LASER:
                this._brimLaserTimer -= dt;
                if (this._brimLaserTimer <= 0) {
                    // 激光结束：检测当前是否按着方向键，是则立刻开始蓄力
                    if (head.fireDir === null && head.aimDirection) {
                        this._brimState = S.CHARGING;
                        this._brimCharge = 0;
                    } else {
                        this._brimState = S.IDLE;
                        this._brimFired = true;
                    }
                }
                break;
        }
    }

    private _spawnTear(dir: Vec2): void {
        const gs = GameState.i;
        const bv = this._body.velocity;
        const mx = bv.x * this.momentumFactor;
        const my = bv.y * this.momentumFactor;

        const tear = instantiate(this.tearPrefab);
        tear.setParent(this.node.parent!);
        tear.setWorldPosition(this._calcSpawnPos(dir));

        const tearComp = tear.getComponent(Tear);
        if (tearComp) {
            tearComp.init(
                dir,
                gs.tearSpeed,
                gs.range,
                this.fallSpeed,
                this.fallStartRatio,
                gs.enemyPiercing,
                gs.wallPiercing,
                mx,
                my,
                Math.max(1, gs.tearDamage * gs.damageMul + (DollarBill.active ? DollarBill.dmg : 0)),
                this.breakSound,
                this.breakVolume,
                gs.homing,
            );

            const body = tear.getChildByName('Body');
            if (body) {
                const sp = body.getComponent('cc.Sprite') as Sprite;
                if (gs.tearSf) sp.spriteFrame = gs.tearSf;
                if (DollarBill.active) sp.color = DollarBill.color;
            }

            if (this.fireSound) this._audioSrc.playOneShot(this.fireSound, this.fireVolume);
        }
    }

    private _calcSpawnPos(dir: Vec2): Vec3 {
        this._headNode.getWorldPosition(this._spawnPos);
        if (dir.x !== 0) {
            this._spawnPos.x += dir.x * this.spawnOffsetX;
        } else {
            this._spawnPos.y += dir.y * this.spawnOffsetY;
        }
        return this._spawnPos;
    }
}
