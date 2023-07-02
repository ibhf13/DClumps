class test2 {
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

class test1 {
  public smellyMethod2(paraX: number, paraString: string, paraY: number): void {
    let tempString: string = paraString;
    paraX = (paraY = paraY + 8) + 10;
  }
  //
  public normalMethod(): void {
    let test = new test2();
    test.smellyMethod1(10, 5, "w", "x");
    this.smellyMethod2(10, "dummy string1", 6);
  }
}
