import { testFunction, anotherFunction } from "./functions";

function functionExample() {
  testFunction("Hello", 123, true, ["A", "B", "C"], new Date());
  anotherFunction(456, false, "World", ["X", "Y", "Z"], new Date());
}

export { functionExample };
