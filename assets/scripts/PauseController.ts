import { _decorator, Component, Node, input, Input, EventKeyboard, KeyCode, director } from 'cc';
import { GameState } from './GameState';
import { SaveCollector } from './SaveCollector';

const { ccclass, property } = _decorator;

@ccclass('PauseController')
export class PauseController extends Component {

    @property({ type: Node, displayName: 'Pause_UI' })
    pauseUI: Node = null!;

    private _arrowContinue: Node = null!;
    private _arrowQuit: Node = null!;
    private _deathUI: Node | null = null;
    private _paused = false;
    private _selectedContinue = true;

    private static _lastLoadTime = 0;

    onLoad(): void {
        this._arrowContinue = this.pauseUI.getChildByName('Arrow_Continue')!;
        this._arrowQuit = this.pauseUI.getChildByName('Arrow_Quit')!;
        this._deathUI = this.node.getChildByName('Death_UI');
    }

    start(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    private _onKey(e: EventKeyboard): void {
        if (this._deathUI?.active) return;
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
                    if (Date.now() - PauseController._lastLoadTime < 1000) return;
                    PauseController._lastLoadTime = Date.now();
                    GameState.i.save(SaveCollector.collect());
                    director.resume();
                    director.loadScene('menu');
                }
                break;
        }
    }

    /** 暂停/恢复切换（移动端 Esc 按钮调用） */
    togglePause(): void {
        if (this._deathUI?.active) return;
        if (this._paused) {
            this._hide();
        } else {
            this._show();
        }
    }

    get isPaused(): boolean { return this._paused; }

    /** 暂停菜单：选 Continue（移动端 W 按钮） */
    pauseSelectUp(): void {
        if (!this._paused) return;
        this._selectedContinue = true;
        this._arrowContinue.active = true;
        this._arrowQuit.active = false;
    }

    /** 暂停菜单：选 Quit（移动端 S 按钮） */
    pauseSelectDown(): void {
        if (!this._paused) return;
        this._selectedContinue = false;
        this._arrowContinue.active = false;
        this._arrowQuit.active = true;
    }

    /** 暂停菜单：确认（移动端 Enter 按钮） */
    pauseConfirm(): void {
        if (!this._paused) return;
        if (this._selectedContinue) {
            this._hide();
        } else {
            if (Date.now() - PauseController._lastLoadTime < 1000) return;
            PauseController._lastLoadTime = Date.now();
            GameState.i.save(SaveCollector.collect());
            director.resume();
            director.loadScene('menu');
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
