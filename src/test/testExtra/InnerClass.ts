class OuterClass {
  outerMethod(xInner: number, yInner: number, name: string): void {
    let temp = xInner - yInner;
    xInner = 0;
    name = "new name";

    class InnerClass {
      inMethod(
        name: string,
        age: string,
        xInner: number,
        yInner: number
      ): void {
        xInner = 8 * yInner;
        name = xInner.toString();
      }
    }
  }
}
