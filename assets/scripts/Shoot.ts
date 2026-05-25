import {
    _decorator, Component, Node, Prefab, Vec2, Vec3,
    AudioClip, AudioSource, SpriteFrame, Sprite, Color, tween, v3, Tween,
} from 'cc';
import { Head } from './Head';
import { Body } from './Body';
import { GameState } from './GameState';
import { IAttackStrategy } from './IAttackStrategy';
import { NormalTearStrategy } from './NormalTearStrategy';
import { BrimstoneStrategy } from './BrimstoneStrategy';
import { AttackType } from './Constants';

const { ccclass, property } = _decorator;

/**
 * 攻击管理器 — 根据 GameState.attackType 切换攻击策略。
 * 自身不包含攻击逻辑，全部委托给 IAttackStrategy。
 * @property 保持与旧 Shoot 兼容，供策略读取。
 */
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

    @property({ type: [SpriteFrame], displayName: '蓄力条帧(0→100%)' })
    chargeBarFrames: SpriteFrame[] = [];

    @property({ type: Node, displayName: '蓄力条节点' })
    chargeBarNode: Node | null = null;

    @property({ type: AudioClip, displayName: '硫磺火发射音效' })
    brimstoneFireSound: AudioClip | null = null;

    // ── 策略可访问的公共引用 ──

    private _head: Head = null!;
    private _body: Body = null!;
    private _headNode: Node = null!;
    private _audioSrc: AudioSource = null!;
    private _spawnPos = new Vec3();
    private _strategy: IAttackStrategy = null!;
    private _currentType = AttackType.NORMAL;
    private _chargeBarSp: Sprite | null = null;
    private _chargeBarPulse = false;

    get head(): Head { return this._head; }
    get body(): Body { return this._body; }
    get audioSrc(): AudioSource { return this._audioSrc; }

    calcSpawnPos(dir: Vec2): Vec3 {
        this._headNode.getWorldPosition(this._spawnPos);
        if (dir.x !== 0) {
            this._spawnPos.x += dir.x * this.spawnOffsetX;
        } else {
            this._spawnPos.y += dir.y * this.spawnOffsetY;
        }
        return this._spawnPos;
    }

    // ── 生命周期 ──

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
        this._initChargeBar();

        this._currentType = gs.attackType;
        this._strategy = this._makeStrategy(this._currentType);
        this._strategy.init();
    }

    update(dt: number): void {
        const gs = GameState.i;
        gs.tickEffects(dt);

        // 攻击类型变更 → 切换策略
        if (gs.attackType !== this._currentType) {
            this._strategy.destroy();
            this._currentType = gs.attackType;
            this._strategy = this._makeStrategy(this._currentType);
            this._strategy.init();
        }

        this._strategy.update(dt);
    }

    // ── 蓄力条 ──

    private _initChargeBar(): void {
        const node = this.chargeBarNode || this.node.getChildByName('ChargeBar');
        if (node) {
            this._chargeBarSp = node.getComponent(Sprite);
            node.active = false;
        }
    }

    /** 更新蓄力条 0~1，满时红色+鼓动 */
    updateChargeBar(ratio: number): void {
        if (!this._chargeBarSp || this.chargeBarFrames.length === 0) return;
        const node = this._chargeBarSp.node;
        if (!node.active) node.active = true;

        const idx = Math.min(
            Math.floor(ratio * this.chargeBarFrames.length),
            this.chargeBarFrames.length - 1,
        );
        this._chargeBarSp.spriteFrame = this.chargeBarFrames[idx] || null;

        if (ratio >= 1) {
            this._chargeBarSp.color = Color.RED;
            if (!this._chargeBarPulse) {
                this._chargeBarPulse = true;
                tween(node)
                    .to(0.12, { scale: v3(1.2, 1.2, 1) }, { easing: 'sineInOut' })
                    .to(0.12, { scale: v3(1, 1, 1) }, { easing: 'sineInOut' })
                    .union()
                    .repeatForever()
                    .start();
            }
        }
    }

    /** 清除蓄力条（取消/发射/非蓄力态） */
    clearChargeBar(): void {
        if (this._chargeBarSp) {
            Tween.stopAllByTarget(this._chargeBarSp.node);
            this._chargeBarSp.node.setScale(1, 1, 1);
            this._chargeBarSp.spriteFrame = null;
            this._chargeBarSp.color = Color.WHITE;
            this._chargeBarSp.node.active = false;
        }
        this._chargeBarPulse = false;
    }

    private _makeStrategy(type: AttackType): IAttackStrategy {
        switch (type) {
            case AttackType.BRIMSTONE:
                return new BrimstoneStrategy(this);
            default:
                return new NormalTearStrategy(this);
        }
    }
}
