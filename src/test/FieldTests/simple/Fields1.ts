import { FieldsWithConstructor } from "./FieldsWithConstructor";

class Field1 {
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
