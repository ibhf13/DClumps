import { FieldsWithConstructor } from "./FieldsWithConstructor";

export class Fields3 {
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
