import { _decorator, Component, Node, Sprite, director } from 'cc';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

@ccclass('BossIntroManager')
export class BossIntroManager extends Component {

    static instance: BossIntroManager | null = null;

    @property({ type: Node, displayName: 'Boss_Fight_UI' })
    bossFightUI: Node = null!;

    private _portrait: Sprite = null!;
    private _nameLabel: Sprite = null!;
    private _shown = false;

    onLoad(): void {
        BossIntroManager.instance = this;
        this._portrait = this.bossFightUI.getChildByName('BossPortrait')!.getComponent(Sprite)!;
        this._nameLabel = this.bossFightUI.getChildByName('bossname')!.getComponent(Sprite)!;
    }

    /** 播放入场动画，gridKey 用于去重 */
    static show(bossNode: Node, gridKey: string): void {
        const self = BossIntroManager.instance;
        if (!self || self._shown) return;
        if (GameState.i.bossIntroDone.has(gridKey)) return;

        self._shown = true;
        GameState.i.bossIntroDone.add(gridKey);

        const pNode = bossNode.getChildByName('portrait');
        const nNode = bossNode.getChildByName('bossname');
        if (pNode) self._portrait.spriteFrame = pNode.getComponent(Sprite)!.spriteFrame;
        if (nNode) self._nameLabel.spriteFrame = nNode.getComponent(Sprite)!.spriteFrame;

        director.pause();
        self.bossFightUI.active = true;

        setTimeout(() => {
            self.bossFightUI.active = false;
            self._shown = false;
            director.resume();
        }, 3000);
    }
}
