import {
    _decorator, Component, Node, Sprite, input, Input, EventKeyboard, KeyCode, director, isValid,
} from 'cc';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

const PLACE_COUNT = 5;

@ccclass('DeathScreen')
export class DeathScreen extends Component {

    @property({ type: Node, displayName: 'Death_UI' })
    deathUI: Node = null!;

    private _places: Node[] = [];
    private _monsterSprite: Sprite = null!;

    private static _lastLoadTime = 0;

    onLoad(): void {
        for (let i = 1; i <= PLACE_COUNT; i++) {
            const child = this.deathUI.getChildByName(`Death_Place_0${i}`);
            if (child) this._places.push(child);
        }
        this._monsterSprite = this.deathUI.getChildByName('Monster')!.getComponent(Sprite)!;
    }

    start(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    show(killerNode: Node | null): void {
        if (this._places.length > 0) {
            const pick = Math.floor(Math.random() * this._places.length);
            for (let i = 0; i < this._places.length; i++) {
                this._places[i].active = i === pick;
            }
        }

        if (isValid(killerNode) && this._monsterSprite) {
            const p = killerNode!.getChildByName('portrait');
            if (p) this._monsterSprite.spriteFrame = p.getComponent(Sprite)!.spriteFrame;
        }

        this.deathUI.active = true;
        director.pause();
    }

    private _onKey(e: EventKeyboard): void {
        if (!this.deathUI.active) return;
        if (e.keyCode === KeyCode.ESCAPE || e.keyCode === KeyCode.ENTER || e.keyCode === KeyCode.SPACE) {
            if (Date.now() - DeathScreen._lastLoadTime < 1000) return;
            DeathScreen._lastLoadTime = Date.now();
            GameState.i.deleteSave();
            director.resume();
            director.loadScene('menu');
        }
    }
}
