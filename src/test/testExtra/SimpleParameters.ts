class Parametes1 {
  public smellyMethod1(
    paraX: number,
    paraY: number,
    paraNormal: string,
    paraString: string
  ): void {
    let tempString: string = paraString;
    paraX = paraY + 10;
  }

  public normalMethod(): void {
    this.smellyMethod1(10, 5, "dummy string1", "dummy string2");
  }
}

class Paramete2 {
  public smellyMethod2(paraX: number, paraY: number, paraString: string): void {
    paraString = paraY.toString();
    paraX = 1;
  }

  public normalMethod(): void {
    let test = new test2();
    test.smellyMethod1(10, 2, "q", "qwqwqw");
    this.smellyMethod2(10, 5, "text");
  }
}
