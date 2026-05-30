import { _decorator, Component, Button, sys } from 'cc';

const { ccclass } = _decorator;

/**
 * 移动端适配引导 — 挂在 Canvas 或 Canvas-UI 上（始终 active）。
 * 检测到手机端时激活 Phone_UI 子节点，并连线按钮到对应控制器。
 */
@ccclass('PhoneAdapter')
export class PhoneAdapter extends Component {

    start(): void {
        const phoneUI = this.node.getChildByName('Phone_UI');
        if (!phoneUI || !sys.isMobile) return;

        phoneUI.active = true;

        const escBtn = phoneUI.getChildByName('Esc');
        const enterBtn = phoneUI.getChildByName('Enter');
        const wBtn = phoneUI.getChildByName('W');
        const sBtn = phoneUI.getChildByName('S');

        const menuCtrl = this.node.getComponent('MenuController') as any;
        const startCtrl = this.getComponentInChildren('StartController') as any;
        const endCtrl = this.getComponentInChildren('EndController') as any;
        const pauseCtrl = this.node.getComponent('PauseController') as any;
        const deathScreen = this.node.getComponent('DeathScreen') as any;

        // ── 菜单场景：W/S → 选择切换, Enter → 确认 ──

        if (menuCtrl) {
            if (wBtn) {
                wBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                    menuCtrl.toggleSelection?.();
                });
            }
            if (sBtn) {
                sBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                    menuCtrl.toggleSelection?.();
                });
            }
            if (enterBtn) {
                enterBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                    menuCtrl.onEnter?.();
                });
            }
            return;
        }

        // ── Start场景：Enter → 进入菜单 ──

        if (startCtrl && enterBtn) {
            enterBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                startCtrl.onEnter?.();
            });
            return;
        }

        // ── End场景：Enter / Esc → 淡出回Start ──

        if (endCtrl) {
            if (enterBtn) {
                enterBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                    endCtrl.onEnter?.();
                });
            }
            if (escBtn) {
                escBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                    endCtrl.onEnter?.();
                });
            }
            return;
        }

        // ── 游戏场景：暂停/死亡/正常状态动态切换 ──

        // Esc: 死亡→关闭 / 暂停→恢复 / 正常→暂停
        if (escBtn && pauseCtrl) {
            escBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                if (deathScreen?.isVisible) {
                    deathScreen.dismiss?.();
                } else {
                    pauseCtrl.togglePause?.();
                }
            });
        }

        // Enter: 死亡→关闭 / 暂停→确认选择
        if (enterBtn) {
            enterBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                if (deathScreen?.isVisible) {
                    deathScreen.dismiss?.();
                } else if (pauseCtrl?.isPaused) {
                    pauseCtrl.pauseConfirm?.();
                }
            });
        }

        // W: 暂停中→选Continue
        if (wBtn && pauseCtrl) {
            wBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                if (pauseCtrl.isPaused) pauseCtrl.pauseSelectUp?.();
            });
        }

        // S: 暂停中→选Quit
        if (sBtn && pauseCtrl) {
            sBtn.getComponent(Button)?.node.on(Button.EventType.CLICK, () => {
                if (pauseCtrl.isPaused) pauseCtrl.pauseSelectDown?.();
            });
        }
    }
}
