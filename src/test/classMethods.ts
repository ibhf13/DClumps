class ExampleClass {
  method1(param1: string, param2: number, param3: boolean) {
    console.log("Inside method1:", param1, param2, param3);
    this.method2(true, "Hello", "world", 2);
  }

  method2(param3: boolean, param4: string, param1: string, param2: number) {
    console.log("Inside method2:", param1, param2, param3);
    this.method1("Parameter", 42, true);
  }
}
