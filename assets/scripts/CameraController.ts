import { _decorator, Component, Node, tween, Tween, v3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 摄像机控制器，挂载于 Camera 节点。
 * 平滑移动 GameManager 使目标房间居中。
 */
@ccclass('CameraController')
export class CameraController extends Component {

    @property({ displayName: '移动时长(秒)' })
    moveDuration = 0.3;

    private _gm: Node | null = null;

    /** 移动到目标房间位置 */
    moveToRoom(roomNode: Node): void {
        if (!this._gm) {
            this._gm = this.node.parent?.getChildByName('GameManager') ?? null;
        }
        if (!this._gm) return;

        const rp = roomNode.position;
        const targetPos = v3(-rp.x, -rp.y, this._gm.position.z);

        Tween.stopAllByTarget(this._gm);
        tween(this._gm)
            .to(this.moveDuration, { position: targetPos }, { easing: 'sineInOut' })
            .start();
    }
}
