import { ComplexParameter1 } from "./ComplexParameters";

export class ParameterTest1 {
  //only one Method
  public smellyMethod1(
    paraX: number,
    paraString: string,
    paraBoolean: boolean
  ): void {
    let paraNumber: number = 12;
    //1. Update with getter
    paraString;
    let tempString: string = paraString;

    //2. Update with getter and setter
    paraX = paraX + paraNumber;
    paraX = paraX + 40;
    paraX = paraX + paraX;
  }

  public normalMethod(): void {
    this.smellyMethod1(10, "dummy string1", true);
    let complexInstance = new ComplexParameter1();
    complexInstance.smellyMethod1(false, 167, "Complex");
  }
}

class ParameterTest2 {
  public smellyMethod2(
    paraString: string,
    paraBoolean: boolean,
    paraX: number,
    paraY: number
  ): void {
    paraX = 1;
  }

  public normalMethod(): void {
    this.smellyMethod2("Text", false, 5, 4);
    let newInstance = new ParameterTest1();
    newInstance.smellyMethod1(2, "string", true);

    let complexInstance = new ComplexParameter1();
    complexInstance.smellyMethod1(false, 167, "Complex");
  }
}
