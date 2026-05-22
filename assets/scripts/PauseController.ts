import { _decorator, Component, Node, input, Input, EventKeyboard, KeyCode, director } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PauseController')
export class PauseController extends Component {

    @property({ type: Node, displayName: 'Pause_UI' })
    pauseUI: Node = null!;

    private _arrowContinue: Node = null!;
    private _arrowQuit: Node = null!;
    private _paused = false;
    private _selectedContinue = true;

    onLoad(): void {
        this._arrowContinue = this.pauseUI.getChildByName('Arrow_Continue')!;
        this._arrowQuit = this.pauseUI.getChildByName('Arrow_Quit')!;
    }

    start(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    private _onKey(e: EventKeyboard): void {
        if (this._paused) {
            this._handlePauseInput(e.keyCode);
            return;
        }
        if (e.keyCode === KeyCode.ESCAPE) {
            this._show();
        }
    }

    private _handlePauseInput(code: KeyCode): void {
        switch (code) {
            case KeyCode.ESCAPE:
                this._hide();
                break;
            case KeyCode.KEY_W:
            case KeyCode.KEY_S:
                this._selectedContinue = !this._selectedContinue;
                this._arrowContinue.active = this._selectedContinue;
                this._arrowQuit.active = !this._selectedContinue;
                break;
            case KeyCode.ENTER:
                if (this._selectedContinue) {
                    this._hide();
                } else {
                    director.resume();
                    director.loadScene('start');
                }
                break;
        }
    }

    private _show(): void {
        this._paused = true;
        this._selectedContinue = true;
        this._arrowContinue.active = true;
        this._arrowQuit.active = false;
        director.pause();
        this.pauseUI.active = true;
    }

    private _hide(): void {
        this.pauseUI.active = false;
        director.resume();
        this._paused = false;
    }
}
