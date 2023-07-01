/**
 * Class1 and Class2 have anInterface in common but they have two methods that were not related to the interface
 * These two methods include duplicated parameters and should be reported as a dataclump
 */

interface AnInterface {
  notSmellyMethod(interNX: number, interNY: number, interNString: string): void;
}

class Class1 {
  constructor(interfaceInstance: AnInterface) {
    interfaceInstance.notSmellyMethod(0, 0, "");
  }

  aSmellyMethod1(interX: number, interY: number, interString: string) {
    // Implementation of aSmellyMethod1 in Class1
  }
}

class Class2 {
  constructor(interfaceInstance: AnInterface) {
    interfaceInstance.notSmellyMethod(0, 0, "");
  }

  aSmellyMethod2(interX: number, interY: number, interString: string) {
    // Implementation of aSmellyMethod2 in Class2
  }
}

const interfaceInstance: AnInterface = {
  notSmellyMethod(interNX: number, interNY: number, interNString: string) {
    // Implementation of notSmellyMethod
  },
};

const class1Instance = new Class1(interfaceInstance);
const class2Instance = new Class2(interfaceInstance);
