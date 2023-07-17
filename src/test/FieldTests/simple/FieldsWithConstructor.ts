export class FieldsWithConstructor {
  fieldsString: string;
  fieldBoolean1: Boolean;
  fieldsY: number;
  fieldBoolean2: Boolean;
  constructor(
    fieldBoolean1: Boolean,
    fieldsY: number,
    fieldsString: string,
    fieldBoolean2: Boolean
  ) {
    this.fieldBoolean1 = fieldBoolean1;
    this.fieldBoolean2 = fieldBoolean2;
    this.fieldsY = fieldsY;
    this.fieldsString = fieldsString;
  }

  normalMethod(): void {
    this.fieldsY = 50;
    this.fieldsString = this.fieldsY.toString();
    this.fieldBoolean1 = !this.fieldBoolean2;
  }
}
