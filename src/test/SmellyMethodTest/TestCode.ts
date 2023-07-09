class test2 {
  public smellyMethod1000(
    paraX: number,
    paraNormal: string,
    paraString: string
  ): void {
    let tempString: string = paraString;
    paraX = paraY + 10;
  }

  public normalMethod(): void {
    this.smellyMethod1000(10, "dummy string1", "dummy string2");
  }
}
class test3 {
  public smellyMethod1(paraX: number, paraString: string): void {
    let tempString: string = paraString;
    paraX = paraY + 10;
  }

  public normalMethod(): void {
    this.smellyMethod1(10, "dummy string2");
  }
}

class test1 {
  public smellyMethod234(
    paraX: number,
    paraString: string,
    paraY: number
  ): void {
    //variableDeclarationstatment
    let tesmstring2: string = paraString;
    let tempString: string = (paraString = paraString + "hi") + paraString;
    let paraZ = 9;
    //expressionStatement
    paraX;
    //geschachtelet binaryExpression
    paraX = (paraY = paraY + paraZ) + 10;
    //if statement
    if (paraString) {
      //return statement
      return (paraString = paraString + "qwe");
    }
  }
  //
  public normalMethod(): void {
    let test = new test2();
    test.smellyMethod1000(10, "w", "x");
    this.smellyMethod234(10, "dummy string1", 6);
  }
}
