class NewClass {
  method3(param1: string, param2: number, param3: boolean, param4: boolean) {
    console.log("Inside method3:", param1, param2, param3);
  }

  method4(param3: boolean, param1: string) {
    console.log("Inside method4:", param1, param3);
  }

  invokeExampleClassMethods() {
    const example = new ExampleClass();
    example.method1("Hello", 123, false);
    example.method2(true, "World", "hi", 23);
  }
}

const newExample = new NewClass();
newExample.method3("Greetings", 77, true, false);
newExample.method4(false, "du");
