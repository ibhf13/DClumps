export class ParaXParaStringParaY {
    private paraX: number;
    private paraString: string;
    private paraY: number;

    constructor(paraX: number, paraString: string, paraY: number) {
        this.paraY = paraY;
    }

    get getParaX(): number {
        return this.paraX;
    }

    set setParaX(paraX: number) {
        this.paraX = paraX;
    }

    get getParaString(): string {
        return this.paraString;
    }

    set setParaString(paraString: string) {
        this.paraString = paraString;
    }

    get getParaY(): number {
        return this.paraY;
    }

    set setParaY(paraY: number) {
        this.paraY = paraY;
    }
}
