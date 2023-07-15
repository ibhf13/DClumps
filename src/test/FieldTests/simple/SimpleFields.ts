import { FieldsWithConstructor } from "./SimpleFields2";
import { Fields22 } from "./SimpleFieldsNegative";
import { FieldsStringFieldsY } from "./SimpleFieldsNegativeNewClassCreated";

class Fields2 {
  fieldsString = "name";
  fieldsY: number;

  normalMethod(): void {
    this.fieldsY = 50;
    this.fieldsString = this.fieldsY.toString();
    let fields3Instance = new Fields3();
    // non binary statements
    if (fields3Instance.fieldsY === fields3Instance.fieldsY + 9) {
      // non binary statements
      console.log(fields3Instance.fieldsY);
      fields3Instance.fieldBoolean1;
    }

    //geschachtelete statements
    // binary statement
    fields3Instance.fieldBoolean1 =
      // binary statement             non binary statements
      (fields3Instance.fieldsY = 19 + fields3Instance.fieldsY) ===
      // non binary statements
      fields3Instance.fieldsY;

    // binary statement for not relevant obj
    let testObj = (fields3Instance.fieldsString =
      // non binary statements (Call expression)
      fields3Instance.fieldsY.toString() + "hi");

    // let obj = new Fields22(new FieldsStringFieldsY("name", undefined), 10);
    // obj.fieldsStringFieldsYInstance.getFieldsY;
    let obj2 = new FieldsWithConstructor(true, 2, "waaaw", false);
    obj2.fieldBoolean1 = obj2.fieldsString === obj2.fieldsY.toString();
  }
}

class Fields3 {
  fieldsY: number;
  fieldsString: string;
  fieldBoolean1: Boolean = true;

  normalMethod(): void {
    let temp = this.fieldsY + 20;
    this.fieldsY = 10 * this.fieldsY;
    if (this.fieldsY === (this.fieldsY = this.fieldsY + 1) + 8)
      this.fieldsString = "new string";
    console.log("fieldsString", this.fieldsString);
    let obj2 = new FieldsWithConstructor(true, 2, "waaaw", false);
    obj2.fieldBoolean1 = obj2.fieldsString === obj2.fieldsY.toString();
  }
}

class Field3Test {
  fieldsY: number;
  fieldsString: string;
  fieldBoolean1: Boolean = true;
  //
  //fall instance in class variable
  obj3: FieldsWithConstructor = new FieldsWithConstructor(
    true,
    2,
    "waaaw",
    false
  );
  //
  //fall instance in constructor
  constructor(fieldsY, fieldsString, fieldBoolean1, obj3) {
    //
    //fall usage in constructor body
    this.fieldsY = obj3.fieldsY;
    this.fieldsString = obj3.fieldsString;
    this.fieldBoolean1 = obj3.fieldBoolean1;
  }
  //
  // fall new instance in method parameter
  methodTest(obj5: FieldsWithConstructor): void {
    let temp = this.fieldsY + 20;
    this.fieldsY = 10 * this.fieldsY;
    if (this.fieldsY === (this.fieldsY = this.fieldsY + 1) + 8)
      this.fieldsString = "new string" + this.fieldsY.toString();
    console.log("fieldsString", this.fieldsString);
    //
    //fall new instance in method block
    let obj4 = new FieldsWithConstructor(true, 2, "waaaw", false);
    //
    // fall usage all instances from method block, method parameter and class variable
    obj4.fieldBoolean1 = obj5.fieldsString === this.obj3.fieldsY.toString();
  }
}
