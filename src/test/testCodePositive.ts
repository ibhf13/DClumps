import { ParaXParaStringParaY } from "../output/extractedClasses/test1";

class test2 {
  public smellyMethod1(
    paraNormal: string,
    newParam: ParaXParaStringParaY
  ): void {
    let tempString: string = newParam.getParaString();
    newParam.setParaX(newParam.getParaY() + 10);
  }

  public normalMethod(): void {
    const smellyMethod1Instance = new ParaXParaStringParaY(
      10,
      "dummy string1",
      5
    );
    this.smellyMethod1("dummy string2", smellyMethod1Instance);
  }
}

class test1 {
  public smellyMethod2(newParam: ParaXParaStringParaY): void {
    let tempString: string = newParam.getParaString();
    newParam.setParaX(newParam.getParaY() + 10);
  }

  public normalMethod(): void {
    let test = new test2();
    const smellyMethod2Instance2 = new ParaXParaStringParaY(10, 5, "w");
    test.smellyMethod1("x", smellyMethod2Instance2);
    const smellyMethod2Instance = new ParaXParaStringParaY(
      10,
      "dummy string1",
      6
    );
    this.smellyMethod2(smellyMethod2Instance);
  }
}
