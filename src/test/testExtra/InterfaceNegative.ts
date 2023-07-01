interface SomeInterface {
  notSmellyMethod(interX: number, interY: number, interString: string): void;
}

class Class1 {
  constructor(someInterfaceInstance: SomeInterface) {
    someInterfaceInstance.notSmellyMethod(0, 0, "");
  }

  notSmellyMethod(interX: number, interY: number, interString: string) {
    // Implementation of notSmellyMethod in Class1
  }
}

class Class2 {
  constructor(someInterfaceInstance: SomeInterface) {
    someInterfaceInstance.notSmellyMethod(0, 0, "");
  }

  notSmellyMethod(interX: number, interY: number, interString: string) {
    // Implementation of notSmellyMethod in Class2
  }
}

const someInterfaceInstance: SomeInterface = {
  notSmellyMethod(interX: number, interY: number, interString: string) {
    // Implementation of notSmellyMethod
  },
};

const class1Instance = new Class1(someInterfaceInstance);
const class2Instance = new Class2(someInterfaceInstance);
