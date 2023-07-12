import { FieldsStringFieldsY } from "./SimpleFieldsNegativeNewClassCreated";

class Fields22 {
  fieldsStringFieldsYInstance: FieldsStringFieldsY = new FieldsStringFieldsY();

  constructor() {
    this.fieldsStringFieldsYInstance.setFieldsString("name");
  }

  normalMethod(): void {
    this.fieldsStringFieldsYInstance.setFieldsY(50);
    this.fieldsStringFieldsYInstance.setFieldsString(
      this.fieldsStringFieldsYInstance.getFieldsY().toString()
    );
  }
}

class Fields33 {
  fieldsX = 10;
  fieldsStringFieldsYInstance: FieldsStringFieldsY;

  constructor(
    fieldsX: number,
    fieldsStringFieldsYInstance: FieldsStringFieldsY
  ) {
    this.fieldsX = 10;
    this.fieldsStringFieldsYInstance = fieldsStringFieldsYInstance;
  }
  normalMethod(): void {
    let temp = this.fieldsX + 20;
    this.fieldsStringFieldsYInstance.setFieldsY(10 * this.fieldsX);
    this.fieldsStringFieldsYInstance.setFieldsString("new string");
  }
}
