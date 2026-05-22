export class CollectiblePool {

    private static _collected: Set<string> = new Set();

    static markCollected(name: string): void {
        CollectiblePool._collected.add(name);
    }

    static isCollected(name: string): boolean {
        return CollectiblePool._collected.has(name);
    }

    static resetIfAllCollected(allNames: string[]): boolean {
        if (allNames.length === 0) return false;
        if (allNames.every(n => CollectiblePool._collected.has(n))) {
            CollectiblePool._collected.clear();
            return true;
        }
        return false;
    }

    static availableCount(allNames: string[]): number {
        return allNames.filter(n => !CollectiblePool._collected.has(n)).length;
    }
}
