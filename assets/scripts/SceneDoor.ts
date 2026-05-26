import { _decorator, Component, Collider2D, Contact2DType, director } from 'cc';
import { GROUP } from './Constants';
import { GameState } from './GameState';

const { ccclass } = _decorator;

@ccclass('SceneDoor')
export class SceneDoor extends Component {

    /** 由 Room 在运行时从 MapGenerator 读取后赋值 */
    sceneName = '';

    start(): void {
        const collider = this.node.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
        }
    }

    private _onContact(_self: Collider2D, other: Collider2D): void {
        if (other.group !== GROUP.PLAYER || !this.sceneName) return;
        GameState.i.sceneTransitioning = true;
        director.loadScene(this.sceneName);
    }
}
