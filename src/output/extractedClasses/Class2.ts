export class InterXInterYInterString {
    private interX: number;
    private interY: number;
    private interString: string;

    constructor(interX: number, interY: number, interString: string) {
        this.interString = interString;
    }

    get getInterX(): number {
        return this.interX;
    }

    set setInterX(interX: number) {
        this.interX = interX;
    }

    get getInterY(): number {
        return this.interY;
    }

    set setInterY(interY: number) {
        this.interY = interY;
    }

    get getInterString(): string {
        return this.interString;
    }

    set setInterString(interString: string) {
        this.interString = interString;
    }
}
