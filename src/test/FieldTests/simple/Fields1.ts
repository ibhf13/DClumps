import { FieldsWithConstructor } from "./FieldsWithConstructor";
//data clumps of 4
class Field1 {
  fieldsY: number;
  fieldsString: string;
  fieldBoolean1: boolean = true;
  //
  //fall instance in class variable
  // obj3: FieldsWithConstructor;
  //
  //fall instance in constructor
  constructor(
    fieldsY: number,
    fieldsString: string,
    fieldBoolean1: boolean,
    obj3: FieldsWithConstructor
  ) {
    //
    //fall usage in constructor body
    this.fieldsY = obj3.fieldsY;
    this.fieldsString = obj3.fieldsString;
    this.fieldBoolean1 = obj3.fieldBoolean1;
  }

  /**
   * Calls need to be updated
   * 1. fall new instance in method block obj4
   * 2. fall new instance in class field and used in method block obj3
   * 3. fall new instance in method parameter obj5
   */
  methodTest(obj5: FieldsWithConstructor): void {
    let temp = this.fieldsY + 20;
    this.fieldsY = 10 * this.fieldsY;
    if (this.fieldsY === (this.fieldsY = this.fieldsY + 1) + 8)
      this.fieldsString = "new string" + this.fieldsY.toString();
    console.log("fieldsString", this.fieldsString);
    //
    //
    let obj4 = new FieldsWithConstructor(true, 2, "waaaw", false);
    //
    // fall usage all instances from method block, method parameter and class variable
    obj4.fieldBoolean1 = obj5.fieldsString === "";
  }
}
