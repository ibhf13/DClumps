class fieldsStringFieldsY {
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
