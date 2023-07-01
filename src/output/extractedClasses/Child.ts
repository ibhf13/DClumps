export class Dup2Dup1Dup3 {
    private dup2: number;
    private dup1: number;
    private dup3: number;

    constructor(dup2: number, dup1: number, dup3: number) {
        this.dup3 = dup3;
    }

    get getDup2(): number {
        return this.dup2;
    }

    set setDup2(dup2: number) {
        this.dup2 = dup2;
    }

    get getDup1(): number {
        return this.dup1;
    }

    set setDup1(dup1: number) {
        this.dup1 = dup1;
    }

    get getDup3(): number {
        return this.dup3;
    }

    set setDup3(dup3: number) {
        this.dup3 = dup3;
    }
}
