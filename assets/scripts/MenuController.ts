import {
    _decorator, Component, Node, UIOpacity, Prefab,
    input, Input, EventKeyboard, KeyCode, director, tween,
} from 'cc';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

@ccclass('MenuController')
export class MenuController extends Component {

    @property({ type: [Prefab], displayName: '藏品预制体池' })
    collectiblePrefabs: Prefab[] = [];

    @property({ displayName: '淡出时长(秒)', range: [0.5, 5, 0.5], slide: true })
    fadeDuration = 2;

    private _arrowNew: Node = null!;
    private _arrowContinue: Node = null!;
    private _selectedNew = true;
    private _triggered = false;

    onLoad(): void {
        this._arrowNew = this.node.getChildByName('Arrow_New')!;
        this._arrowContinue = this.node.getChildByName('Arrow_Continue')!;
    }

    start(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    private _onKey(e: EventKeyboard): void {
        if (this._triggered) return;
        switch (e.keyCode) {
            case KeyCode.KEY_W:
            case KeyCode.KEY_S:
                this._selectedNew = !this._selectedNew;
                this._arrowNew.active = this._selectedNew;
                this._arrowContinue.active = !this._selectedNew;
                break;
            case KeyCode.ENTER:
            case KeyCode.SPACE:
                this._triggered = true;
                input.off(Input.EventType.KEY_DOWN, this._onKey, this);
                if (this._selectedNew) {
                    GameState.collectiblePrefabs = this.collectiblePrefabs;
                } else if (GameState.hasSave) {
                    GameState.i.shouldContinue = true;
                }
                this._fadeAndStart();
                break;
        }
    }

    private _fadeAndStart(): void {
        const opacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        opacity.opacity = 255;

        tween(opacity)
            .to(this.fadeDuration, { opacity: 0 }, { easing: 'sineInOut' })
            .call(() => director.loadScene('01_isaac_room'))
            .start();
    }
}
