import { Fields22 } from "./SimpleFieldsNegative";
import { FieldsStringFieldsY } from "./SimpleFieldsNegativeNewClassCreated";

class Fields2 {
  fieldsString = "name";
  fieldsY: number;

  normalMethod(): void {
    this.fieldsY = 50;
    this.fieldsString = this.fieldsY.toString();
    let fields3Instance = new Fields3();
    if (fields3Instance.fieldsY === fields3Instance.fieldsY + 9);
    let testObj = (fields3Instance.fieldsString =
      fields3Instance.fieldsY.toString() + "hi");
    let obj = new Fields22(new FieldsStringFieldsY("name", undefined), 10);
    obj.fieldsStringFieldsYInstance.getFieldsY;
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
  }
}
