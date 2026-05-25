import {
    _decorator, Component, Node, input, Input, EventKeyboard, KeyCode, director,
    AudioClip, AudioSource, game,
} from 'cc';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

@ccclass('StartController')
export class StartController extends Component {

    @property({ type: AudioClip, displayName: '背景音乐' })
    bgm: AudioClip | null = null;

    @property({ displayName: '音乐音量', range: [0, 1, 0.05], slide: true })
    bgmVolume = 0.7;

    private _triggered = false;

    start(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKey, this);

        // 创建跨场景持久 BGM 节点（Start→Menu 无缝衔接）
        if (this.bgm && !GameState.persistBgmNode) {
            const node = new Node('SceneBGM');
            game.addPersistRootNode(node);
            const src = node.addComponent(AudioSource);
            src.clip = this.bgm;
            src.loop = true;
            src.volume = this.bgmVolume;
            src.play();
            GameState.persistBgmNode = node;
        }
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
