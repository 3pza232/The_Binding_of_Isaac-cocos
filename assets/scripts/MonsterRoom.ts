import { _decorator } from "cc";
import { Monster } from "./Monster";
import { RoomManager, RoomState } from "./RoomManager";

const { ccclass, property } = _decorator;

/**
 * 怪物房：当房间内所有 Monster 死亡时清除。
 * 挂载于怪物房的 RoomManager 节点。
 */
@ccclass("MonsterRoom")
export class MonsterRoom extends RoomManager {
    @property({ displayName: "怪物数量" })
    monsterCount = 0;

    protected onFirstEnter(): void {}

    protected checkCleared(): boolean {
        if (this.roomState !== RoomState.ACTIVE) return false;

        // 统计本节点下还活着的 Monster 组件数量
        let alive = 0;
        this.node.walk((n) => {
            if (n.getComponent(Monster)) alive++;
        });
        return alive === 0;
    }
}
