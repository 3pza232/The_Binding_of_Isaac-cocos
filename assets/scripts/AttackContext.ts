import { Vec2, Vec3, Color, SpriteFrame, AudioClip } from 'cc';

/** 攻击参数容器 — 策略填充基础值后经 EffectPipeline 统一修饰 */
export class AttackContext {
    pos = new Vec3();
    dir = new Vec2();
    damage = 3.5;
    speed = 13;
    range = 250;
    color = Color.WHITE.clone();
    spriteFrame: SpriteFrame | null = null;
    homing = false;
    homingStrength = 8;
    enemyPiercing = false;
    wallPiercing = false;
    momentumX = 0;
    momentumY = 0;
    fallSpeed = 5;
    fallStartRatio = 0.6;
    breakSound: AudioClip | null = null;
    breakVolume = 1;

    clone(): AttackContext {
        const c = new AttackContext();
        c.pos.set(this.pos);
        c.dir.set(this.dir);
        c.damage = this.damage;
        c.speed = this.speed;
        c.range = this.range;
        c.color.set(this.color);
        c.spriteFrame = this.spriteFrame;
        c.homing = this.homing;
        c.homingStrength = this.homingStrength;
        c.enemyPiercing = this.enemyPiercing;
        c.wallPiercing = this.wallPiercing;
        c.momentumX = this.momentumX;
        c.momentumY = this.momentumY;
        c.fallSpeed = this.fallSpeed;
        c.fallStartRatio = this.fallStartRatio;
        c.breakSound = this.breakSound;
        c.breakVolume = this.breakVolume;
        return c;
    }
}
