class Fields4 {
  fieldsString = "name";
  fieldBoolean1: Boolean;
  fieldsY: number;
  fieldBoolean2: Boolean;

  normalMethod(): void {
    this.fieldsY = 50;
    this.fieldsString = this.fieldsY.toString();
    this.fieldBoolean1 = !this.fieldBoolean2;
  }
}

class Fields5 {
  fieldBoolean1: Boolean;
  fieldsX = 10;
  fieldsY: number;
  fieldBoolean2: Boolean;
  fieldsString: string;

  normalMethod(): void {
    let temp = this.fieldsX + 20;
    this.fieldsY = 10 * this.fieldsX;
    this.fieldsString = "new string";
  }
}
