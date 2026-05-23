export class GameStats {

    private static _keys = 2;
    private static _coins = 0;

    static get keys(): number { return GameStats._keys; }
    static get coins(): number { return GameStats._coins; }

    static addKeys(n: number): void { GameStats._keys += n; }
    static addCoins(n: number): void { GameStats._coins += n; }

    static spendKey(n = 1): boolean {
        if (GameStats._keys < n) return false;
        GameStats._keys -= n;
        return true;
    }

    static spendCoins(n: number): boolean {
        if (GameStats._coins < n) return false;
        GameStats._coins -= n;
        return true;
    }

    static reset(): void {
        GameStats._keys = 2;
        GameStats._coins = 0;
    }

    static restore(keys: number, coins: number): void {
        GameStats._keys = keys;
        GameStats._coins = coins;
    }
}
