const myArrowFunction = (
  param1: string,
  param2: number,
  param3: boolean,
  param4: string[],
  param5: object
) => {
  console.log(param1, param2, param3, param4, param5);
};

const anotherFunction = () => {
  myArrowFunction("Hello", 42, true, ["a", "b", "c"], { key: "value" });
};

const yetAnotherFunction = () => {
  myArrowFunction("Hello", 42, true, ["d", "e", "f"], { key: "value" });
};

anotherFunction();
yetAnotherFunction();
