export class FieldsStringFieldsY {
  private fieldsString: string;
  private fieldsY: number;
  // add default value if not exist || null
  constructor(fieldsString: string = null, fieldsY: number = null) {
    this.fieldsString = fieldsString;
    this.fieldsY = fieldsY;
  }

  getFieldsString(): string {
    return this.fieldsString;
  }

  setFieldsString(value: string): void {
    this.fieldsString = value;
  }

  getFieldsY(): number {
    return this.fieldsY;
  }

  setFieldsY(value: number): void {
    this.fieldsY = value;
  }
}
