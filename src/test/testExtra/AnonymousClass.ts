class NormalClass {
    public method1(): void {
    }
}

class AnotherNormalClass {
    public method2(an1: number, an2: number, an3: number): void {
    }
}

class Anonymous {
    public normalMethod(): void {
        const n: NormalClass = new (class extends NormalClass {
            public smellyMethod(an2: number, an1: number, an3: number): void {

            }
        })();
    }
}
