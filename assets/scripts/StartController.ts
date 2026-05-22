import {
    _decorator, Component, input, Input, EventKeyboard, KeyCode, UIOpacity, tween, director,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('StartController')
export class StartController extends Component {

    @property({ displayName: '淡出时长(秒)', range: [1, 10, 0.5], slide: true })
    fadeDuration = 3;

    private _opacity: UIOpacity = null!;
    private _triggered = false;

    onLoad(): void {
        this._opacity = this.node.getComponent(UIOpacity)!;
    }

    start(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    private _onKey(e: EventKeyboard): void {
        if (this._triggered) return;
        if (e.keyCode !== KeyCode.ENTER && e.keyCode !== KeyCode.SPACE) return;

        this._triggered = true;
        tween(this._opacity)
            .to(this.fadeDuration, { opacity: 0 }, { easing: 'sineInOut' })
            .call(() => director.loadScene('01_isaac_room'))
            .start();
    }
}
