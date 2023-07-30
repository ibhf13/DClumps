import { FieldsWithConstructor } from "./FieldsWithConstructor";
//data clumps of 4
class Field1 {
  fieldsY: number;
  fieldsString: string;

  fieldBoolean1: boolean = true;
  //4.Fields Object as Classes Field
  //fall instance in class variable
  obj3: FieldsWithConstructor;
  //
  //falls 4  in constructor
  constructor(
    fieldsY: number,
    fieldsString: string,
    fieldBoolean1: boolean,
    obj3: FieldsWithConstructor
  ) {
    //
    //fall usage in constructor body
    this.obj3 = obj3;
    this.fieldsY = obj3.fieldsY;
    this.fieldsString = obj3.fieldsString;
    this.fieldBoolean1 = obj3.fieldBoolean1;
  }

  methodTest(obj5: FieldsWithConstructor): void {
    //-------------------------------------
    //1.own simple Fields
    //PropertyAccessExpression
    let temp = this.fieldsY + 20;

    this.fieldBoolean1;
    this.fieldsY;

    //CallExpression
    this.fieldsY.toString();
    this.fieldsY.toString() === this.fieldsY.toString();

    // Binary Expression + PropertyAccessExpression
    this.fieldsY = 10 * this.fieldsY;
    // 1 semiBinary Expressions(===) 2 Binary Expressions + PropertyAccessExpression +CallExpression
    if (this.fieldsY === (this.fieldsY = this.fieldsY + 1) + 8)
      this.fieldsString = this.fieldsY.toString() + this.fieldsY.toString();
    console.log("fieldsString", this.fieldsString);
    this.fieldBoolean1 = this.fieldsString === "OOO";
    //-------------------------------------

    //-------------------------------------
    // fall usage all instances from method block, method parameter and class variable
    //2 RefInstance usage
    let obj4 = new FieldsWithConstructor(true, 2, "waaaw", false);

    obj4.fieldBoolean1 = obj5.fieldsString === "XXX";
    //PropertyAccessExpression
    obj4.fieldBoolean1;
    //CallExpression
    obj4.fieldsY.toString();
    // Binary Expression + CallExpression + PropertyAccessExpression
    obj4.fieldBoolean1 =
      obj4.fieldsY.toString() === obj4.fieldsString.valueOf();
    //----------------------------------

    //----------------------------------
    //3 Fields in Parameter
    // Binary Expression + PropertyAccessExpression
    obj5.fieldsString = obj5.fieldsString + obj5.fieldsString;
    //CallExpression
    obj5.fieldsY.toString();

    obj5.fieldBoolean1;

    // Binary Expression + CallExpression + PropertyAccessExpression
    obj5.fieldBoolean1 = obj5.fieldsY.toString() === obj5.fieldsString;
    // Binary Expression + 2 CallExpression
    obj5.fieldBoolean1 = obj5.fieldsY.toString() === obj5.fieldsY.toString();
    //----------------------------------

    //----------------------------------
    //4.Fields Object as Classes Field
    // Binary Expression + CallExpression + PropertyAccessExpression
    this.obj3.fieldBoolean1 =
      this.obj3.fieldsY.toString() === this.obj3.fieldsString;
    //PropertyAccessExpression
    this.obj3.fieldsY;
    this.obj3.fieldsY.toString() === this.obj3.fieldsString.valueOf();

    //CallExpression
    this.obj3.fieldsY.toString();
  }
}
