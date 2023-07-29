import { ParameterTest4 } from "./SimpleParameters2";

export class ComplexParameter1 {
  public smellyMethod1(para1: boolean, para2: number, para3: string): void {}
  //only one Method
  public smellyMethod5(
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
    paraBoolean =
      (paraX = paraNumber + paraX).toString() === paraNumber.toString();
  }

  public normalMethod(): void {
    this.smellyMethod1(true, 10, "dummy string1");
  }
}

class ComplexParameter2 {
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
    let newInstance = new ParameterTest4();

    newInstance.smellyMethod4("string", true, 22, 33);
  }
}
