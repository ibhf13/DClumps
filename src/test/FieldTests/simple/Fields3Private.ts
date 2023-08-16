import { FieldsWithConstructor } from "./FieldsWithConstructor";

export class Fields3Private {
  private fieldsY: number;
  private fieldsString: string;
  private fieldBoolean1: boolean = true;

  constructor(fieldsY, fieldsString, fieldBoolean1) {
    //
    //fall usage in constructor body
    this.fieldsY = fieldsY;
    this.fieldsString = fieldsString;
    this.fieldBoolean1 = fieldBoolean1;
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
