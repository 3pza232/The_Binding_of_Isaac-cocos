import { _decorator, Component, Node, Sprite, director } from 'cc';

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

    /** 当前 Boss 房已被清除（死亡后重进不再弹），用 grid key 标识 */
    static _clearedRooms = new Set<string>();
    static restoreClearedRooms(keys: string[]): void {
        BossIntroManager._clearedRooms = new Set(keys);
    }

    /** 从 Boss 节点提取 portrait/bossname 的 SpriteFrame 并播放入场 */
    static show(bossNode: Node, roomGridKey: string): void {
        const self = BossIntroManager.instance;
        if (!self || self._shown) return;
        if (BossIntroManager._clearedRooms.has(roomGridKey)) return;

        self._shown = true;
        BossIntroManager._clearedRooms.add(roomGridKey);

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
