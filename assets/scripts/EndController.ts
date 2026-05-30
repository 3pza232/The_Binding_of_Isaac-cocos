import { _decorator, Component, Node, Sprite, UIOpacity, tween, input, Input, EventKeyboard, KeyCode, director } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 结局面板 — 按键后所有 Sprite 子节点渐隐，然后切换场景。
 * 挂载于 EndPanel 节点。
 */
@ccclass('EndController')
export class EndController extends Component {

    @property({ displayName: '淡出时长(秒)', range: [0.5, 5, 0.5], slide: true })
    fadeDuration = 2;

    @property({ displayName: '目标场景名' })
    targetScene = 'start';

    private _triggered = false;

    start(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    /** 移动端 Enter/Esc 按钮调用 */
    onEnter(): void {
        if (this._triggered) return;
        this._triggered = true;
        this._fadeOut();
    }

    private _onKey(e: EventKeyboard): void {
        if (this._triggered) return;
        if (e.keyCode === KeyCode.ESCAPE || e.keyCode === KeyCode.ENTER || e.keyCode === KeyCode.SPACE) {
            this.onEnter();
        }
    }

    private _fadeOut(): void {
        let done = 0;
        const children = this.node.children;
        const total = children.length;

        for (const child of children) {
            const sp = child.getComponent(Sprite);
            if (!sp) {
                done++;
                if (done >= total) director.loadScene(this.targetScene);
                continue;
            }

            const opacity = child.getComponent(UIOpacity) || child.addComponent(UIOpacity);
            opacity.opacity = 255;

            tween(opacity)
                .to(this.fadeDuration, { opacity: 0 }, { easing: 'sineInOut' })
                .call(() => {
                    done++;
                    if (done >= total) director.loadScene(this.targetScene);
                })
                .start();
        }
    }
}
