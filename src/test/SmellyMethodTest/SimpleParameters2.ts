import { ComplexParameter1 } from "./ComplexParameters";
import { ParameterTest1 } from "./SimpleParameters";

class ParameterTest3 {
  //only one Method
  public smellyMethod3(
    paraBoolean: boolean,
    paraX: number,
    paraString: string
  ): void {
    let paraNumber: number = 12;
    //1. Update with getter
    paraString;
    let tempString: string = paraString;

    //2. Update with getter and setter
    paraX = paraX + paraNumber;
    paraX = paraX + 40;
    paraX = paraX + paraX;

    //3. Call Expresssion
    paraX.toString();
    paraBoolean = paraString.valueOf() === paraX.toString();
  }

  public normalMethod(): void {
    this.smellyMethod3(false, 400, "dummy string1");

    let newInstance = new ParameterTest1();
    newInstance.smellyMethod1(2, "string", true);

    let complexInstance = new ComplexParameter1();
    complexInstance.smellyMethod1(false, 167, "Complex");
  }
}

export class ParameterTest4 {
  public smellyMethod4(
    paraString: string,
    paraBoolean: boolean,
    paraY: number,
    paraX: number
  ): void {
    paraX = 1;
  }

  public normalMethod(): void {
    //1 uncommon parameter (4)
    this.smellyMethod4("Text", false, 5, 4);
  }
}
