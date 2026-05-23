import {
    _decorator, Component, Node, Prefab, instantiate,
    AudioClip, AudioSource, Vec2, Vec3,
} from 'cc';
import { Head } from './Head';
import { Body } from './Body';
import { Tear } from './Tear';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

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
    }

    update(dt: number): void {
        this._cooldown -= dt;
        if (this._cooldown > 0) return;

        const dir = this._head.aimDirection;
        if (!dir) return;

        this._cooldown = GameState.i.fireRate;
        this._spawnTear(dir);
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
                this.piercing,
                mx,
                my,
                gs.tearDamage * gs.damageMul,
                this.breakSound,
                this.breakVolume,
                gs.homing,
            );

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
