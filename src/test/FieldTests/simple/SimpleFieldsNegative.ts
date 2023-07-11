import { fieldsStringFieldsY } from "./SimpleFieldsNegativeNewClassCreated";

class Fields22 {
  fieldsStringFieldsYInstance: fieldsStringFieldsY = new fieldsStringFieldsY(
    "name"
  );

  normalMethod(): void {
    this.fieldsStringFieldsYInstance.setFieldsY(50);
    this.fieldsStringFieldsYInstance.setFieldsString(
      this.fieldsStringFieldsYInstance.getFieldsY().toString()
    );
  }
}

class Fields33 {
  fieldsX = 10;
  fieldsStringFieldsYInstance: fieldsStringFieldsY = new fieldsStringFieldsY();

  normalMethod(): void {
    let temp = this.fieldsX + 20;
    this.fieldsStringFieldsYInstance.setFieldsY(10 * this.fieldsX);
    this.fieldsStringFieldsYInstance.setFieldsString("new string");
  }
}
