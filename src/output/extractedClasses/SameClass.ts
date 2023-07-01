export class PaXPaYPaString {
    private paX: number;
    private paY: number;
    private paString: string;

    constructor(paX: number, paY: number, paString: string) {
        this.paString = paString;
    }

    get getPaX(): number {
        return this.paX;
    }

    set setPaX(paX: number) {
        this.paX = paX;
    }

    get getPaY(): number {
        return this.paY;
    }

    set setPaY(paY: number) {
        this.paY = paY;
    }

    get getPaString(): string {
        return this.paString;
    }

    set setPaString(paString: string) {
        this.paString = paString;
    }
}
