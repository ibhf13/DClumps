import { testFunction, anotherFunction } from "./functions";

class MyClass {
  private data: string[];

  constructor(data: string[]) {
    this.data = data;
  }

  public execute() {
    testFunction("Hello", 123, true, this.data, new Date());
    anotherFunction(456, false, "World", this.data, new Date());
  }
}

const myInstance = new MyClass(["A", "B", "C"]);
myInstance.execute();
