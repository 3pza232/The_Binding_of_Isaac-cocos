import {
    _decorator, Component, input, Input, EventKeyboard, KeyCode, director,
} from 'cc';

const { ccclass } = _decorator;

@ccclass('StartController')
export class StartController extends Component {

    private _triggered = false;

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
        director.loadScene('menu');
    }
}
