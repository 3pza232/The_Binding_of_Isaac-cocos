import {
    _decorator, Component, Node, Prefab, instantiate,
    AudioClip, AudioSource, Vec2, Vec3,
} from "cc";
import { Head } from "./Head";
import { Body } from "./Body";
import { Tear } from "./Tear";

const { ccclass, property } = _decorator;

/**
 * 玩家发射泪弹组件，挂载于 Isaac 节点。
 * 读取 Head 组件的瞄准方向，按间隔实例化 Tear 预制体并注入参数。
 */
@ccclass("Shoot")
export class Shoot extends Component {
    // ── 属性（全部可调参数集中于此） ──

    @property({ type: Prefab, displayName: "泪弹预制体" })
    tearPrefab: Prefab = null!;

    @property({ displayName: "泪弹速度" })
    tearSpeed = 10;

    @property({ displayName: "射程" })
    range = 200;

    @property({ displayName: "射速间隔(秒)" })
    fireRate = 0.5;

    @property({ displayName: "下降起始比例", range: [0, 1, 0.05], slide: true })
    fallStartRatio = 0.6;

    @property({ displayName: "水平下落速度" })
    fallSpeed = 5;

    @property({ displayName: "水平发射偏移(距Head中心)" })
    spawnOffsetX = 5;

    @property({ displayName: "垂直发射偏移(距Head中心)" })
    spawnOffsetY = 5;

    @property({ displayName: "穿墙" })
    piercing = false;

    @property({ displayName: "甩弹比例(玩家速度倍率)", range: [0, 1, 0.01], slide: true })
    momentumFactor = 0.1;

    @property({ displayName: "泪弹伤害" })
    tearDamage = 1;

    @property({ type: AudioClip, displayName: "射击音效" })
    fireSound: AudioClip | null = null;

    @property({ displayName: "射击音量", range: [0, 1, 0.05], slide: true })
    fireVolume = 1;

    @property({ type: AudioClip, displayName: "破裂音效" })
    breakSound: AudioClip | null = null;

    @property({ displayName: "破裂音量", range: [0, 1, 0.05], slide: true })
    breakVolume = 1;

    // ── 内部状态 ──

    private _head: Head = null!;
    private _body: Body = null!;
    private _headNode: Node = null!;
    private _audioSrc: AudioSource = null!;
    private _spawnPos = new Vec3();
    private _cooldown = 0;

    // ── 生命周期 ──

    onLoad(): void {
        this._head = this.node.getComponent(Head)!;
        this._body = this.node.getComponent(Body)!;
        this._headNode = this.node.getChildByName("Head")!;
        this._audioSrc = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
    }

    update(dt: number): void {
        this._cooldown -= dt;
        if (this._cooldown > 0) return;

        const dir = this._head.aimDirection;
        if (!dir) return;

        this._cooldown = this.fireRate;
        this._spawnTear(dir);
    }

    // ── 发射 ──

    private _spawnTear(dir: Vec2): void {
        // 甩弹：发射瞬间捕获玩家速度，发射后泪弹与玩家完全脱钩
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
                this.tearSpeed,
                this.range,
                this.fallSpeed,
                this.fallStartRatio,
                this.piercing,
                mx,
                my,
                this.tearDamage,
                this.breakSound,
                this.breakVolume,
            );

            if (this.fireSound) this._audioSrc.playOneShot(this.fireSound, this.fireVolume);
        }
    }

    /** 以 Head 节点世界坐标为基准，按方向加偏移 */
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
