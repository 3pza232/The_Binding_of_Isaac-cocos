import { _decorator, Component } from "cc";

const { ccclass } = _decorator;

/**
 * Y 轴排序组件
 * 每帧按子节点 worldPosition.y 降序排列 siblingIndex，
 * Y 越小（越靠屏幕下方）的节点渲染层级越高（显示在前面）。
 */
@ccclass("SortManager")
export class SortManager extends Component {
    update(): void {
        const children = this.node.children;
        // Y 降序：Y 大的排前面（index 小，先渲染 = 在后面），Y 小的排后面（后渲染 = 在前面）
        children.sort((a, b) => b.worldPosition.y - a.worldPosition.y);
        for (let i = 0; i < children.length; i++) {
            children[i].setSiblingIndex(i);
        }
    }
}
