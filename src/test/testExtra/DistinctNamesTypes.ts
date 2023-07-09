class Parameters1 {
  public smellyMethod1(
    paraZ: number,
    paraY: number,
    paraNormal: string,
    paraTest: string
  ): void {}
}

class Parameters2 {
  public smellyMethod2(
    paraX: number,
    paraY: number,
    paraTest: boolean,
    paraString: string
  ): void {}
}

class Fields1 {
  fieldsG: number = 10;
  fieldsY: boolean;
  fieldsString: string;
}

class Fields2 {
  fieldsString: string = "name";
  fieldsX: number = 10;
  fieldsG: number = 10;
  fieldsY: number;
}

// class Animal {
//   age2: number;
//   wieght: number;
//   name: string;
// }

// class Cat extends Animal {
//   age: number;
//   wieght: number;
//   name: string;
// }

// class Dog extends Animal {
//   age1: number;
//   wieght2: number;
//   name: string;
// }

class Outer {
  public outMethod(xIn: number, yInner: number, name: string): void {
    class InnerClass {
      inMethod(
        name: string,
        age: string,
        xInner: number,
        yInner: number
      ): void {}
    }
  }
}
