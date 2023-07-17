export class FieldsWithConstructor {
  fieldsString: string;
  fieldBoolean1: boolean;
  fieldsY: number;
  fieldBoolean2: boolean;
  constructor(
    fieldBoolean1: boolean,
    fieldsY: number,
    fieldsString: string,
    fieldBoolean2: boolean
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
