import { FieldsStringFieldsY } from "./FieldsNegativeNewClassCreated";

export class Fields22 {
  fieldsStringFieldsYInstance: FieldsStringFieldsY = new FieldsStringFieldsY(
    "name",
    undefined
  );
  fieldZ: number = 10;
  constructor(obj: FieldsStringFieldsY, fieldZ: number) {
    this.fieldZ = fieldZ;
    this.fieldsStringFieldsYInstance = obj;
  }

  normalMethod(): void {
    this.fieldsStringFieldsYInstance.setFieldsY(50);
    this.fieldsStringFieldsYInstance.setFieldsString(
      this.fieldsStringFieldsYInstance.getFieldsY().toString()
    );
  }
}

class Fields33 {
  fieldZ = 10;
  fieldsStringFieldsYInstance: FieldsStringFieldsY;

  constructor(
    fieldZ: number,
    fieldsStringFieldsYInstance: FieldsStringFieldsY
  ) {
    this.fieldZ = fieldZ;
    this.fieldsStringFieldsYInstance = fieldsStringFieldsYInstance;
  }
  // constructor() {
  //   this.fieldZ = fieldZ;
  //   this.fieldsStringFieldsYInstance = fieldsStringFieldsYInstance;
  // }
  normalMethod(): void {
    let temp = this.fieldZ + 20;
    this.fieldsStringFieldsYInstance.setFieldsY(10 * this.fieldZ);
    this.fieldsStringFieldsYInstance.setFieldsString("new string");
  }
}
